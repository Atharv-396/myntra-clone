const express = require("express");
const Bag = require("../models/Bag");
const Order = require("../models/Order");
const router = express.Router();
const mongoose = require("mongoose");
const { sendNotification } = require("../services/notificationService");
const { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } = require("../constants/notificationTypes");

// Tax rate — centralized, single source of truth
const GST_RATE = 0.18; // 18% GST

/** Calculate shipping based on subtotal */
function calcShipping(subtotal) {
  return subtotal > 0 && subtotal < 999 ? 99 : 0;
}

/** Round to nearest rupee — avoids floating-point display issues */
function roundRupees(amount) {
  return Math.round(amount);
}

function genrateRandomTracking() {
  const carriers = ["Delhivery", "Bluedart", "Ecom Express", "XpressBees"];
  const statusOptions = ["Shipped", "Out for Delivery", "Delivered", "In Transit"];
  const locations = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune"];
  const randomcarrier = carriers[Math.floor(Math.random() * carriers.length)];
  const randomstatusOptions = statusOptions[Math.floor(Math.random() * statusOptions.length)];
  const randomlocations = locations[Math.floor(Math.random() * locations.length)];
  return {
    number: "TRK" + Math.floor(Math.random() * 10000000),
    carrier: randomcarrier,
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    currentLocation: randomlocations,
    status: randomstatusOptions,
    timeline: [
      { status: "Order placed", location: "Warehouse", timestamp: new Date().toISOString() },
      { status: randomstatusOptions, location: randomlocations, timestamp: new Date().toISOString() },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /order/checkout-summary/:userId
// Returns validated cart pricing for the Checkout screen.
// This is the SINGLE source of truth for checkout pricing.
// Validates product availability, stock, and detects price changes.
// Returns: subtotal, shipping, tax, grandTotal, items, priceChanges, warnings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/checkout-summary/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const bagItems = await Bag.find({ userId, savedForLater: false }).populate("productId");

    if (bagItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const validItems = [];
    const invalidItems = [];
    const priceChanges = [];
    const warnings = [];

    for (const item of bagItems) {
      const product = item.productId;

      if (!product || product.active === false) {
        invalidItems.push({
          itemId: item._id,
          productName: product ? product.name : "Unknown product",
          reason: !product ? "Product no longer exists" : "Product is currently unavailable",
        });
        continue;
      }

      // Stock check
      if (product.stock !== undefined && item.quantity > product.stock) {
        warnings.push({
          itemId: item._id,
          productName: product.name,
          requestedQty: item.quantity,
          availableStock: product.stock,
          message: `Only ${product.stock} units of "${product.name}" available`,
        });
      }

      // Price change detection
      const currentPrice = product.price;
      if (item.priceAtAdd && item.priceAtAdd !== currentPrice) {
        priceChanges.push({
          itemId: item._id,
          productName: product.name,
          oldPrice: item.priceAtAdd,
          newPrice: currentPrice,
          priceChanged: true,
        });
        // Update stored price snapshot
        await Bag.findByIdAndUpdate(item._id, { priceAtAdd: currentPrice });
      }

      validItems.push({
        _id: item._id,
        productId: product._id,
        name: product.name,
        brand: product.brand,
        image: product.images?.[0] || "",
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: currentPrice,
        lineTotal: roundRupees(currentPrice * item.quantity),
      });
    }

    const subtotal = roundRupees(validItems.reduce((s, i) => s + i.lineTotal, 0));
    const shipping = calcShipping(subtotal);
    const tax = roundRupees(subtotal * GST_RATE);
    const grandTotal = subtotal + shipping + tax;
    const canCheckout = invalidItems.length === 0 && warnings.length === 0;

    return res.status(200).json({
      canCheckout,
      items: validItems,
      subtotal,
      shipping,
      tax,
      taxRate: GST_RATE,
      grandTotal,
      priceChanges,
      warnings,
      invalidItems,
    });
  } catch (error) {
    console.log("GET /order/checkout-summary error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /order/create/:userId
// Creates order. Backend is authoritative — recalculates total from DB.
// Fixed bug: was "price + quantity" instead of "price * quantity"
// ─────────────────────────────────────────────────────────────────────────────
router.post("/create/:userId", async (req, res) => {
  try {
    const userid = req.params.userId;
    // Only use in-cart items (not saved-for-later)
    const bag = await Bag.find({ userId: userid, savedForLater: false }).populate("productId");
    if (bag.length === 0) {
      return res.status(400).json({ message: "No item in the bag" });
    }

    const orderItems = bag
      .filter((item) => item.productId && item.productId.active !== false)
      .map((item) => ({
        productId: item.productId._id,
        size: item.size,
        price: item.productId.price,   // use current price from DB
        quantity: item.quantity,
      }));

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No valid items in cart" });
    }

    // Authoritative total: price * quantity (fixed from price + quantity)
    const subtotal = roundRupees(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
    const shipping = calcShipping(subtotal);
    const tax = roundRupees(subtotal * GST_RATE);
    const total = subtotal + shipping + tax;

    const newOrder = new Order({
      userId: userid,
      date: new Date().toISOString(),
      status: "Processing",
      items: orderItems,
      total,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      tracking: genrateRandomTracking(),
    });
    await newOrder.save();
    // Clear only in-cart items, not saved-for-later
    await Bag.deleteMany({ userId: userid, savedForLater: false });

    // Fire order confirmed notification (non-blocking)
    sendNotification({
      userId: userid,
      category: NOTIFICATION_CATEGORIES.ORDER,
      type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "Order Confirmed 🎉",
      body: `Your order has been confirmed.`,
      data: { type: "ORDER_CONFIRMED", category: "ORDER", orderId: newOrder._id.toString() },
      idempotencyKey: `order_confirmed:${newOrder._id}`,
    }).catch(() => {});

    res.status(200).json({ message: "Order placed successfully", orderId: newOrder._id, total });
  } catch (error) {
    console.log("POST /order/create error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /order/user/:userid
// ─────────────────────────────────────────────────────────────────────────────
router.get("/user/:userid", async (req, res) => {
  try {
    const order = await Order.find({ userId: req.params.userid }).populate("items.productId");
    res.status(200).json(order);
  } catch (error) {
    console.log("GET /order/user error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /order/:orderId/status — update order status and trigger notification
// Body: { status } — e.g. "Shipped", "Out for Delivery", "Delivered"
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ message: "Invalid orderId" });
    if (!status)
      return res.status(400).json({ message: "status is required" });

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status, "tracking.status": status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Map status string → notification type
    const STATUS_TO_NOTIF = {
      "Processing":       null,
      "Packed":           { type: NOTIFICATION_TYPES.ORDER_PACKED,     cat: NOTIFICATION_CATEGORIES.SHIPPING, title: "Order Packed 📦", body: `Your order is being packed.` },
      "Shipped":          { type: NOTIFICATION_TYPES.ORDER_SHIPPED,    cat: NOTIFICATION_CATEGORIES.SHIPPING, title: "Order Shipped 🚚", body: `Your order is on its way!` },
      "In Transit":       { type: NOTIFICATION_TYPES.ORDER_IN_TRANSIT, cat: NOTIFICATION_CATEGORIES.SHIPPING, title: "Order In Transit 🛣️", body: `Your order is in transit.` },
      "Out for Delivery": { type: NOTIFICATION_TYPES.OUT_FOR_DELIVERY, cat: NOTIFICATION_CATEGORIES.DELIVERY, title: "Out for Delivery 📦", body: `Your order is out for delivery today!` },
      "Delivered":        { type: NOTIFICATION_TYPES.ORDER_DELIVERED,  cat: NOTIFICATION_CATEGORIES.DELIVERY, title: "Order Delivered 🎉", body: `Your order has been delivered.` },
      "Cancelled":        { type: NOTIFICATION_TYPES.ORDER_CANCELLED,  cat: NOTIFICATION_CATEGORIES.ORDER,    title: "Order Cancelled", body: `Your order has been cancelled.` },
    };

    const notif = STATUS_TO_NOTIF[status];
    if (notif) {
      sendNotification({
        userId: order.userId.toString(),
        category: notif.cat,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        data: { type: notif.type, category: notif.cat, orderId: orderId },
        idempotencyKey: `${notif.type.toLowerCase()}:${orderId}`,
      }).catch(() => {});
    }

    return res.status(200).json({ message: "Order status updated", status });
  } catch (error) {
    console.log("PATCH /order/:orderId/status error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;
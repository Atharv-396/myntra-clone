const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Bag = require("../models/Bag");
const Order = require("../models/Order");
const User = require("../models/User");
const {
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
  CASHFREE_ENV,
} = require("../config/cashfree");
const { sendNotification } = require("../services/notificationService");
const { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const GST_RATE = 0.18;

function calcShipping(subtotal) {
  return subtotal > 0 && subtotal < 999 ? 99 : 0;
}

function roundRupees(amount) {
  return Math.round(amount);
}

function generateRandomTracking() {
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
    status: "Processing",
    timeline: [
      { status: "Order placed", location: "Warehouse", timestamp: new Date().toISOString() },
    ],
  };
}

// -----------------------------------------------------------------------------
// POST /payment/cashfree/create-order
// Generates a Cashfree PG payment session for the current user cart
// -----------------------------------------------------------------------------
router.post("/cashfree/create-order", async (req, res) => {
  try {
    const { userId, shippingAddress, customerPhone } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const bag = await Bag.find({ userId, savedForLater: false }).populate("productId");
    if (!bag || bag.length === 0) {
      return res.status(400).json({ message: "Your bag is empty" });
    }

    const validItems = bag.filter((item) => item.productId && item.productId.active !== false);
    if (validItems.length === 0) {
      return res.status(400).json({ message: "No valid products in bag" });
    }

    // Authoritative calculation from DB
    const subtotal = roundRupees(
      validItems.reduce((sum, item) => sum + item.productId.price * item.quantity, 0)
    );
    const shipping = calcShipping(subtotal);
    const tax = roundRupees(subtotal * GST_RATE);
    const grandTotal = subtotal + shipping + tax;

    if (grandTotal <= 0) {
      return res.status(400).json({ message: "Order amount must be greater than 0" });
    }

    // Fetch user details for Cashfree customer profile
    let customerName = "Customer";
    let customerEmail = "customer@example.com";
    let phone = customerPhone || "9999999999";

    try {
      const user = await User.findById(userId);
      if (user) {
        customerName = user.name || user.username || "Customer";
        customerEmail = user.email || "customer@example.com";
      }
    } catch (e) {
      console.log("Could not fetch user details for Cashfree:", e.message);
    }

    // Cashfree order ID format: alphanumeric with hyphen/underscore, max 45 chars
    const cashfreeOrderId = `CF_${userId.toString().slice(-6)}_${Date.now()}`;

    const cashfreeResponse = await createCashfreeOrder({
      orderId: cashfreeOrderId,
      orderAmount: grandTotal,
      customerDetails: {
        customerId: `user_${userId.toString()}`,
        customerName,
        customerEmail,
        customerPhone: phone,
      },
      returnUrl: req.body.returnUrl,
      notifyUrl: req.body.notifyUrl,
    });

    return res.status(200).json({
      success: true,
      orderId: cashfreeResponse.orderId,
      paymentSessionId: cashfreeResponse.paymentSessionId,
      orderAmount: grandTotal,
      orderCurrency: "INR",
      environment: cashfreeResponse.environment || CASHFREE_ENV,
      isSimulated: cashfreeResponse.isSimulated || false,
    });
  } catch (error) {
    console.error("POST /payment/cashfree/create-order error:", error.data || error.message);
    return res.status(500).json({
      message: error.message || "Failed to create Cashfree order",
      details: error.data || null,
    });
  }
});

// -----------------------------------------------------------------------------
// POST /payment/cashfree/verify
// Verifies payment with Cashfree and creates authoritative order in MongoDB
// -----------------------------------------------------------------------------
router.post("/cashfree/verify", async (req, res) => {
  try {
    const { orderId, userId, shippingAddress, paymentId, paymentMethod = "CASHFREE" } = req.body;

    if (!orderId || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "orderId and valid userId are required" });
    }

    // Check if order was already recorded (idempotency check)
    const existingOrder = await Order.findOne({ cashfreeOrderId: orderId });
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: "Order already processed",
        orderId: existingOrder._id,
        total: existingOrder.total,
        status: existingOrder.status,
      });
    }

    // Verify payment status with Cashfree
    const cfOrder = await getCashfreeOrder(orderId);
    const isPaid = cfOrder && (cfOrder.order_status === "PAID" || cfOrder.isSimulated === true);

    if (!isPaid) {
      return res.status(400).json({
        success: false,
        message: `Payment status is ${cfOrder?.order_status || "UNPAID"}. Order not placed.`,
        orderStatus: cfOrder?.order_status,
      });
    }

    // Get current cart items
    const bag = await Bag.find({ userId, savedForLater: false }).populate("productId");
    if (!bag || bag.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const orderItems = bag
      .filter((item) => item.productId && item.productId.active !== false)
      .map((item) => ({
        productId: item.productId._id,
        size: item.size,
        price: item.productId.price,
        quantity: item.quantity,
      }));

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No valid items in cart" });
    }

    const subtotal = roundRupees(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
    const shipping = calcShipping(subtotal);
    const tax = roundRupees(subtotal * GST_RATE);
    const total = subtotal + shipping + tax;

    const newOrder = new Order({
      userId,
      date: new Date().toISOString(),
      status: "Processing",
      items: orderItems,
      total,
      shippingAddress: shippingAddress || "123 Main Street, Apt 4B, New York, NY, 10001",
      paymentMethod,
      paymentStatus: "PAID",
      cashfreeOrderId: orderId,
      cashfreePaymentId: paymentId || `cf_pay_${Date.now()}`,
      tracking: generateRandomTracking(),
    });

    await newOrder.save();

    // Clear active cart items
    await Bag.deleteMany({ userId, savedForLater: false });

    // Send notifications
    sendNotification({
      userId: userId.toString(),
      category: NOTIFICATION_CATEGORIES.ORDER,
      type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "Order Confirmed ??",
      body: `Your payment of ?${total} was successful and your order has been placed.`,
      data: { type: "ORDER_CONFIRMED", category: "ORDER", orderId: newOrder._id.toString() },
      idempotencyKey: `order_confirmed:${newOrder._id}`,
    }).catch(() => {});

    sendNotification({
      userId: userId.toString(),
      category: NOTIFICATION_CATEGORIES.PAYMENT,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
      title: "Payment Received ??",
      body: `Cashfree payment of ?${total} for order #${newOrder._id.toString().slice(-6)} received successfully.`,
      data: { type: "PAYMENT_SUCCESSFUL", category: "PAYMENT", orderId: newOrder._id.toString() },
      idempotencyKey: `payment_success:${newOrder._id}`,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Payment verified and order placed successfully",
      orderId: newOrder._id,
      total,
    });
  } catch (error) {
    console.error("POST /payment/cashfree/verify error:", error);
    return res.status(500).json({ message: "Payment verification failed", error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /payment/cashfree/status/:orderId
// -----------------------------------------------------------------------------
router.get("/cashfree/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const orderData = await getCashfreeOrder(orderId);
    return res.status(200).json(orderData);
  } catch (error) {
    console.error("GET /payment/cashfree/status error:", error);
    return res.status(500).json({ message: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /payment/cashfree/webhook
// -----------------------------------------------------------------------------
router.post("/cashfree/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    // Acknowledge webhook
    console.log("[Cashfree Webhook] Event received:", req.body?.type || "unknown");
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Cashfree Webhook error:", error);
    return res.status(500).json({ message: "Webhook handler error" });
  }
});

module.exports = router;

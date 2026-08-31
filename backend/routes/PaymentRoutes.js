const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Bag = require("../models/Bag");
const Order = require("../models/Order");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const {
  getCashfreeConfig,
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
} = require("../config/cashfree");
const { getPaymentGateway } = require("../services/paymentGateway");
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
// Generates a Cashfree PG payment session and initiates a PENDING transaction
// -----------------------------------------------------------------------------
router.post("/cashfree/create-order", async (req, res) => {
  try {
    const { userId, shippingAddress, customerPhone, returnUrl, notifyUrl } = req.body;

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
    let phone = (customerPhone || "").replace(/\D/g, "").slice(-10) || "9999999999";

    try {
      const user = await User.findById(userId);
      if (user) {
        customerName = user.name || user.username || "Customer";
        customerEmail = user.email || "customer@example.com";
      }
    } catch (e) {
      console.log("Could not fetch user details for Cashfree customer profile:", e.message);
    }

    // Cashfree order ID format: alphanumeric with hyphen/underscore, max 45 chars
    const cashfreeOrderId = `CF_${userId.toString().slice(-6)}_${Date.now()}`;

    // Create order on Cashfree PG
    const cashfreeResponse = await createCashfreeOrder({
      orderId: cashfreeOrderId,
      orderAmount: grandTotal,
      customerDetails: {
        customerId: `user_${userId.toString()}`,
        customerName,
        customerEmail,
        customerPhone: phone,
      },
      returnUrl,
      notifyUrl,
      orderNote: `Myntra Clone Order for ${customerName}`,
    });

    // Create initial Transaction record in MongoDB for auditing
    const internalTxnId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const transaction = new Transaction({
      transactionId: internalTxnId,
      userId,
      gateway: "CASHFREE",
      gatewayOrderId: cashfreeResponse.orderId,
      paymentSessionId: cashfreeResponse.paymentSessionId,
      amount: grandTotal,
      currency: "INR",
      status: "PENDING",
      paymentMethod: "CASHFREE",
      gatewayResponse: {
        cfOrderId: cashfreeResponse.cfOrderId,
        orderStatus: cashfreeResponse.orderStatus,
      },
      auditLog: [
        {
          action: "ORDER_SESSION_CREATED",
          timestamp: new Date(),
          note: `Created Cashfree payment session for ₹${grandTotal}`,
        },
      ],
      idempotencyKey: `cf_order_${cashfreeResponse.orderId}`,
    });

    await transaction.save();

    return res.status(200).json({
      success: true,
      orderId: cashfreeResponse.orderId,
      cfOrderId: cashfreeResponse.cfOrderId,
      paymentSessionId: cashfreeResponse.paymentSessionId,
      orderAmount: grandTotal,
      orderCurrency: "INR",
      environment: cashfreeResponse.environment,
      transactionId: transaction.transactionId,
    });
  } catch (error) {
    console.error("POST /payment/cashfree/create-order error:", error.code || error.message);
    return res.status(error.status || 500).json({
      message: error.message || "Failed to create Cashfree order",
      code: error.code || "PAYMENT_CREATION_FAILED",
      details: error.data || null,
    });
  }
});

// -----------------------------------------------------------------------------
// POST /payment/cashfree/verify
// Authoritatively verifies payment with Cashfree server, updates Transaction,
// creates confirmed Order, and clears user active bag items.
// -----------------------------------------------------------------------------
router.post("/cashfree/verify", async (req, res) => {
  try {
    const { orderId, userId, shippingAddress, paymentId, paymentMethod = "CASHFREE" } = req.body;

    if (!orderId || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "orderId and valid userId are required" });
    }

    // 1. Idempotency Check: if order is already created in MongoDB, return it immediately
    const existingOrder = await Order.findOne({ cashfreeOrderId: orderId }).populate("transactionId");
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: "Order already processed and confirmed",
        orderId: existingOrder._id,
        transactionId: existingOrder.transactionId?.transactionId || existingOrder.cashfreePaymentId,
        total: existingOrder.total,
        status: existingOrder.status,
        paymentStatus: existingOrder.paymentStatus,
      });
    }

    // 2. Authoritative Verification with Cashfree PG Server
    let isPaid = false;
    let cfPaymentDetails = null;
    let cfOrder = null;

    try {
      cfOrder = await getCashfreeOrder(orderId);
      isPaid = cfOrder && cfOrder.order_status === "PAID";

      // Fetch payment details from Cashfree if available
      try {
        const payments = await getCashfreeOrderPayments(orderId);
        if (Array.isArray(payments) && payments.length > 0) {
          const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS") || payments[0];
          cfPaymentDetails = successfulPayment;
        }
      } catch (payErr) {
        console.log("[Cashfree Verify] Notice: payments detail lookup:", payErr.message);
      }
    } catch (apiErr) {
      console.error("[Cashfree Verify] Server-side verification API error:", apiErr.message);
      return res.status(400).json({
        success: false,
        message: `Could not verify payment with Cashfree: ${apiErr.message}`,
        code: apiErr.code || "VERIFICATION_FAILED",
      });
    }

    if (!isPaid) {
      // Mark transaction as failed / pending if exists
      await Transaction.findOneAndUpdate(
        { gatewayOrderId: orderId },
        {
          $set: { status: "FAILED" },
          $push: {
            auditLog: {
              action: "VERIFICATION_FAILED",
              timestamp: new Date(),
              note: `Server-side verification returned order_status=${cfOrder?.order_status || "UNKNOWN"}`,
            },
          },
        }
      );

      return res.status(400).json({
        success: false,
        message: `Payment status is ${cfOrder?.order_status || "UNPAID"}. Order cannot be confirmed.`,
        orderStatus: cfOrder?.order_status,
      });
    }

    // 3. Get in-cart items from database to compute authoritative order contents
    const bag = await Bag.find({ userId, savedForLater: false }).populate("productId");
    const validBagItems = (bag || []).filter((item) => item.productId && item.productId.active !== false);

    let orderItems = [];
    let total = 0;

    if (validBagItems.length > 0) {
      orderItems = validBagItems.map((item) => ({
        productId: item.productId._id,
        size: item.size,
        price: item.productId.price,
        quantity: item.quantity,
      }));

      const subtotal = roundRupees(
        orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      );
      const shipping = calcShipping(subtotal);
      const tax = roundRupees(subtotal * GST_RATE);
      total = subtotal + shipping + tax;
    } else {
      // Fallback to Cashfree verified order amount if cart was already cleared
      total = roundRupees(cfOrder.order_amount || 0);
    }

    const verifiedPaymentId =
      cfPaymentDetails?.cf_payment_id ||
      cfPaymentDetails?.payment_id ||
      paymentId ||
      `cf_pay_${Date.now()}`;

    const paymentGroup =
      cfPaymentDetails?.payment_group ||
      cfPaymentDetails?.payment_method?.payment_group ||
      paymentMethod;

    // 4. Update or Create Transaction
    let transaction = await Transaction.findOne({ gatewayOrderId: orderId });
    if (transaction) {
      transaction.status = "SUCCESS";
      transaction.gatewayPaymentId = verifiedPaymentId;
      transaction.paymentMethod = paymentGroup;
      transaction.auditLog.push({
        action: "PAYMENT_VERIFIED",
        timestamp: new Date(),
        note: `Payment verified via Cashfree server API. Payment ID: ${verifiedPaymentId}`,
      });
      await transaction.save();
    } else {
      transaction = new Transaction({
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        userId,
        gateway: "CASHFREE",
        gatewayOrderId: orderId,
        gatewayPaymentId: verifiedPaymentId,
        amount: total,
        currency: "INR",
        status: "SUCCESS",
        paymentMethod: paymentGroup,
        auditLog: [
          {
            action: "PAYMENT_VERIFIED_DIRECT",
            timestamp: new Date(),
            note: `Direct server verification confirmed paid.`,
          },
        ],
      });
      await transaction.save();
    }

    // 5. Create authoritatively confirmed Order
    const newOrder = new Order({
      userId,
      date: new Date().toISOString(),
      status: "Processing",
      items: orderItems,
      total,
      shippingAddress: shippingAddress || "123 Main Street, Apt 4B, New York, NY, 10001",
      paymentMethod,
      paymentStatus: "PAID",
      transactionId: transaction._id,
      cashfreeOrderId: orderId,
      cashfreePaymentId: verifiedPaymentId,
      tracking: generateRandomTracking(),
    });

    await newOrder.save();

    // Link Order back to Transaction
    transaction.orderId = newOrder._id;
    await transaction.save();

    // 6. Clear active cart items
    await Bag.deleteMany({ userId, savedForLater: false });

    // 7. Dispatch push notifications with idempotency keys
    sendNotification({
      userId: userId.toString(),
      category: NOTIFICATION_CATEGORIES.ORDER,
      type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      title: "Order Confirmed 🎉",
      body: `Your payment of ₹${total} was successful and your order has been placed.`,
      data: { type: "ORDER_CONFIRMED", category: "ORDER", orderId: newOrder._id.toString() },
      idempotencyKey: `order_confirmed:${newOrder._id}`,
    }).catch(() => {});

    sendNotification({
      userId: userId.toString(),
      category: NOTIFICATION_CATEGORIES.PAYMENT,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
      title: "Payment Received 💳",
      body: `Cashfree payment of ₹${total} for order #${newOrder._id.toString().slice(-6)} received successfully.`,
      data: { type: "PAYMENT_SUCCESSFUL", category: "PAYMENT", orderId: newOrder._id.toString() },
      idempotencyKey: `payment_success:${newOrder._id}`,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Payment verified and order placed successfully",
      orderId: newOrder._id,
      transactionId: transaction.transactionId,
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
    console.error("GET /payment/cashfree/status error:", error.code || error.message);
    return res.status(error.status || 500).json({ message: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /payment/cashfree/webhook & POST /payment/webhook
// Unified secure webhook handler with HMAC-SHA256 verification and idempotency
// -----------------------------------------------------------------------------
async function handleCashfreeWebhook(req, res) {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // 1. Signature Verification (HMAC-SHA256)
    const isSignatureValid = verifyCashfreeWebhookSignature(signature, rawBody, timestamp);
    if (!isSignatureValid) {
      console.warn("[Cashfree Webhook] Security Alert: Invalid webhook signature received.");
      return res.status(401).json({ success: false, message: "Invalid webhook signature" });
    }

    // 2. Parse Event Data via Gateway Service
    const gateway = getPaymentGateway("CASHFREE");
    const event = gateway.parseWebhookEvent(req.body);

    console.log(`[Cashfree Webhook] Verified event: ${event.eventType} for Order: ${event.orderId}`);

    const idempotencyKey = `wh_${event.paymentId || event.orderId}_${event.eventType}`;

    // 3. Check for Duplicate Webhook Event (Idempotency)
    let transaction = await Transaction.findOne({
      $or: [
        { gatewayOrderId: event.orderId },
        { gatewayPaymentId: event.paymentId },
        { idempotencyKey },
      ],
    });

    if (transaction) {
      // Check if event already logged in audit history
      const alreadyProcessed = transaction.webhookEvents.some(
        (e) => e.eventType === event.eventType && String(e.payload?.payment?.cf_payment_id) === String(event.paymentId)
      );

      if (alreadyProcessed && (transaction.status === "SUCCESS" || event.paymentStatus !== "SUCCESS")) {
        console.log(`[Cashfree Webhook] Idempotent skip: Event ${idempotencyKey} already processed.`);
        return res.status(200).json({ success: true, message: "Webhook already processed" });
      }

      // Record webhook event in transaction audit trail
      transaction.webhookEvents.push({
        eventType: event.eventType,
        eventTime: event.eventTime,
        payload: req.body,
      });
      transaction.auditLog.push({
        action: `WEBHOOK_${event.eventType}`,
        timestamp: new Date(),
        note: `Processed webhook status: ${event.paymentStatus}`,
      });
    }

    // 4. Handle Payment Success
    if (event.paymentStatus === "SUCCESS" || event.eventType === "PAYMENT_SUCCESS_WEBHOOK" || event.eventType === "ORDER_PAID_SUCCESS") {
      if (!transaction) {
        transaction = new Transaction({
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          gateway: "CASHFREE",
          gatewayOrderId: event.orderId,
          gatewayPaymentId: event.paymentId,
          amount: event.paymentAmount || event.orderAmount,
          currency: event.paymentCurrency || "INR",
          status: "SUCCESS",
          paymentMethod: event.paymentMethod,
          webhookEvents: [{ eventType: event.eventType, eventTime: event.eventTime, payload: req.body }],
          auditLog: [{ action: "WEBHOOK_PAYMENT_SUCCESS", timestamp: new Date(), note: "Webhook confirmed success" }],
          idempotencyKey,
        });
      } else {
        transaction.status = "SUCCESS";
        transaction.gatewayPaymentId = event.paymentId;
        transaction.paymentMethod = event.paymentMethod;
      }

      await transaction.save();

      // Find associated Order and confirm payment status
      const order = await Order.findOne({
        $or: [{ cashfreeOrderId: event.orderId }, { transactionId: transaction._id }],
      });

      if (order) {
        order.paymentStatus = "PAID";
        order.cashfreePaymentId = event.paymentId;
        order.transactionId = transaction._id;
        if (order.status === "Pending Payment" || !order.status) {
          order.status = "Processing";
        }
        await order.save();

        transaction.orderId = order._id;
        if (order.userId) {
          transaction.userId = order.userId;
        }
        await transaction.save();

        // Clear bag for user if available
        if (order.userId) {
          await Bag.deleteMany({ userId: order.userId, savedForLater: false }).catch(() => {});
        }

        // Fire confirmation notification
        if (order.userId) {
          sendNotification({
            userId: order.userId.toString(),
            category: NOTIFICATION_CATEGORIES.PAYMENT,
            type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
            title: "Payment Confirmed 💳",
            body: `Cashfree confirmed payment of ₹${event.paymentAmount || order.total} for order #${order._id.toString().slice(-6)}.`,
            data: { type: "PAYMENT_SUCCESSFUL", category: "PAYMENT", orderId: order._id.toString() },
            idempotencyKey: `wh_payment_success:${order._id}`,
          }).catch(() => {});
        }
      }
    } else if (event.paymentStatus === "FAILED" || event.paymentStatus === "USER_DROPPED") {
      // Handle Payment Failure
      if (transaction) {
        transaction.status = event.paymentStatus === "USER_DROPPED" ? "USER_DROPPED" : "FAILED";
        transaction.gatewayPaymentId = event.paymentId;
        await transaction.save();
      }

      const order = await Order.findOne({ cashfreeOrderId: event.orderId });
      if (order && order.paymentStatus !== "PAID") {
        order.paymentStatus = "FAILED";
        await order.save();
      }
    }

    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error("[Cashfree Webhook] Error processing event:", error.message);
    return res.status(500).json({ message: "Webhook handler error" });
  }
}

router.post("/cashfree/webhook", handleCashfreeWebhook);
router.post("/webhook", handleCashfreeWebhook);

// -----------------------------------------------------------------------------
// GET /payment/transaction/:id
// Lookup Transaction details
// -----------------------------------------------------------------------------
router.get("/transaction/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { transactionId: id }] } : { transactionId: id };

    const transaction = await Transaction.findOne(query).populate("orderId", "total status shippingAddress createdAt");
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.status(200).json({
      success: true,
      transactionId: transaction.transactionId,
      orderId: transaction.orderId,
      gateway: transaction.gateway,
      gatewayOrderId: transaction.gatewayOrderId,
      gatewayPaymentId: transaction.gatewayPaymentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      createdAt: transaction.createdAt,
      auditTrail: transaction.auditLog,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching transaction", error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /payment/transaction/order/:orderId
// Lookup Transaction by Order ID
// -----------------------------------------------------------------------------
router.get("/transaction/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
    const query = isObjectId
      ? { $or: [{ orderId: orderId }, { gatewayOrderId: orderId }] }
      : { gatewayOrderId: orderId };

    const transaction = await Transaction.findOne(query);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction for this order not found" });
    }

    return res.status(200).json({
      success: true,
      transactionId: transaction.transactionId,
      orderId: transaction.orderId,
      gateway: transaction.gateway,
      gatewayOrderId: transaction.gatewayOrderId,
      gatewayPaymentId: transaction.gatewayPaymentId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      createdAt: transaction.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching transaction", error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /payment/transactions/user/:userId
// Lookup all transactions for a user
// -----------------------------------------------------------------------------
router.get("/transactions/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .populate("orderId", "total status items createdAt");

    return res.status(200).json({ success: true, count: transactions.length, transactions });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching user transactions", error: error.message });
  }
});

module.exports = router;

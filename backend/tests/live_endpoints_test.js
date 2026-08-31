const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const PaymentRoutes = require("../routes/PaymentRoutes");
const OrderRoutes = require("../routes/OrderRoutes");
const User = require("../models/User");
const Product = require("../models/Product");
const Bag = require("../models/Bag");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const { getCashfreeConfig } = require("../config/cashfree");

async function runLiveEndpointTests() {
  console.log("\n=======================================================");
  console.log("   TESTING ALL PAYMENT ENDPOINTS WITH LIVE CREDENTIALS ");
  console.log("=======================================================\n");

  const app = express();
  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    })
  );
  app.use("/payment", PaymentRoutes);
  app.use("/order", OrderRoutes);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("  [DB] Connected to MongoDB");

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, data };
  }

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${e.message}`);
      failed++;
    }
  }

  // Set up a test user and test product in MongoDB
  let testUser = await User.findOne({ email: "testuser_payment@example.com" });
  if (!testUser) {
    testUser = await User.create({
      fullName: "Cashfree Tester",
      email: "testuser_payment@example.com",
      password: "hashed_password_placeholder",
    });
  }

  let testProduct = await Product.findOne({ name: "Cashfree Test T-Shirt" });
  if (!testProduct) {
    testProduct = await Product.create({
      name: "Cashfree Test T-Shirt",
      brand: "Roadster",
      price: 499,
      discount: "50% OFF",
      images: ["https://example.com/image.jpg"],
      sizes: ["S", "M", "L", "XL"],
      stock: 50,
      active: true,
    });
  }

  // Put item in bag
  await Bag.deleteMany({ userId: testUser._id });
  await Bag.create({
    userId: testUser._id,
    productId: testProduct._id,
    size: "L",
    color: "Navy",
    quantity: 1,
    priceAtAdd: 499,
    savedForLater: false,
  });

  let createdCfOrderId = null;
  let createdTxnId = null;

  // -------------------------------------------------------------
  // Test 1: POST /payment/cashfree/create-order (Live Cashfree API)
  // -------------------------------------------------------------
  await test("Endpoint 1: POST /payment/cashfree/create-order (Generates live Cashfree session)", async () => {
    const res = await request("/payment/cashfree/create-order", {
      method: "POST",
      body: JSON.stringify({
        userId: testUser._id.toString(),
        shippingAddress: "Flat 101, Test Avenue, Bengaluru - 560001",
        customerPhone: "9876543210",
      }),
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.orderId, "Merchant orderId must be returned");
    assert.ok(res.data.cfOrderId, "Cashfree CF Order ID must be returned");
    assert.ok(res.data.paymentSessionId, "Cashfree paymentSessionId must be returned");
    assert.ok(res.data.paymentSessionId.startsWith("session_"), "Payment session ID must start with session_");
    assert.strictEqual(res.data.environment, "SANDBOX");
    assert.ok(res.data.transactionId, "Internal Transaction ID must be created");

    createdCfOrderId = res.data.orderId;
    createdTxnId = res.data.transactionId;

    // Verify PENDING transaction in DB
    const txn = await Transaction.findOne({ transactionId: createdTxnId });
    assert.ok(txn, "Transaction record must exist in DB");
    assert.strictEqual(txn.status, "PENDING");
    assert.strictEqual(txn.gateway, "CASHFREE");
    assert.strictEqual(txn.gatewayOrderId, createdCfOrderId);
  });

  // -------------------------------------------------------------
  // Test 2: GET /payment/cashfree/status/:orderId
  // -------------------------------------------------------------
  await test("Endpoint 2: GET /payment/cashfree/status/:orderId (Queries live Cashfree status)", async () => {
    assert.ok(createdCfOrderId, "Must have created order ID");
    const res = await request(`/payment/cashfree/status/${createdCfOrderId}`, { method: "GET" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order_id, createdCfOrderId);
    assert.strictEqual(res.data.order_status, "ACTIVE");
    assert.strictEqual(res.data.order_currency, "INR");
  });

  // -------------------------------------------------------------
  // Test 3: POST /payment/cashfree/verify (Unpaid rejection)
  // -------------------------------------------------------------
  await test("Endpoint 3: POST /payment/cashfree/verify (Safely rejects unpaid orders)", async () => {
    assert.ok(createdCfOrderId, "Must have created order ID");
    const res = await request("/payment/cashfree/verify", {
      method: "POST",
      body: JSON.stringify({
        orderId: createdCfOrderId,
        userId: testUser._id.toString(),
        shippingAddress: "Flat 101, Test Avenue, Bengaluru - 560001",
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.message.includes("ACTIVE") || res.data.message.includes("UNPAID"));
  });

  // -------------------------------------------------------------
  // Test 4: POST /payment/cashfree/webhook (Live Secret Signature)
  // -------------------------------------------------------------
  const livePaymentId = `cf_pay_live_${Date.now()}`;
  await test("Endpoint 4: POST /payment/cashfree/webhook (Verifies real HMAC signature and confirms order)", async () => {
    const config = getCashfreeConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const webhookPayload = {
      data: {
        order: {
          order_id: createdCfOrderId,
          cf_order_id: "215031206373312",
          order_amount: 588.0,
          order_currency: "INR",
        },
        payment: {
          cf_payment_id: livePaymentId,
          payment_status: "SUCCESS",
          payment_amount: 588.0,
          payment_currency: "INR",
          payment_group: "upi",
          payment_time: new Date().toISOString(),
        },
        customer_details: {
          customer_id: `user_${testUser._id.toString()}`,
          customer_name: "Cashfree Tester",
          customer_phone: "9876543210",
        },
      },
      event_time: new Date().toISOString(),
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac("sha256", config.secretKey)
      .update(`${timestamp}${rawBody}`)
      .digest("base64");

    const res = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
      },
      body: rawBody,
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.data.success, true);

    // Verify Transaction was updated to SUCCESS in DB
    const txn = await Transaction.findOne({ transactionId: createdTxnId });
    assert.ok(txn, "Transaction must exist in DB");
    assert.strictEqual(txn.status, "SUCCESS");
    assert.strictEqual(txn.gatewayPaymentId, livePaymentId);
    assert.strictEqual(txn.paymentMethod, "upi");
    assert.ok(txn.webhookEvents.length > 0, "Webhook event must be audited");
  });

  // -------------------------------------------------------------
  // Test 5: POST /payment/cashfree/webhook (Idempotent duplicate check)
  // -------------------------------------------------------------
  await test("Endpoint 5: POST /payment/cashfree/webhook (Duplicate webhook idempotency)", async () => {
    const config = getCashfreeConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const webhookPayload = {
      data: {
        order: { order_id: createdCfOrderId, order_amount: 588.0 },
        payment: { cf_payment_id: livePaymentId, payment_status: "SUCCESS", payment_amount: 588.0 },
      },
      event_time: new Date().toISOString(),
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac("sha256", config.secretKey)
      .update(`${timestamp}${rawBody}`)
      .digest("base64");

    const res = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
      },
      body: rawBody,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Verify only 1 transaction exists for this payment ID
    const count = await Transaction.countDocuments({ gatewayPaymentId: livePaymentId });
    assert.strictEqual(count, 1, "Must maintain exactly 1 financial transaction record");
  });

  // -------------------------------------------------------------
  // Test 6: GET /payment/transaction/:id
  // -------------------------------------------------------------
  await test("Endpoint 6: GET /payment/transaction/:id (Look up transaction details)", async () => {
    const res = await request(`/payment/transaction/${createdTxnId}`, { method: "GET" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.transactionId, createdTxnId);
    assert.strictEqual(res.data.status, "SUCCESS");
    assert.strictEqual(res.data.gateway, "CASHFREE");
    assert.strictEqual(res.data.gatewayPaymentId, livePaymentId);
    assert.ok(res.data.createdAt);
  });

  // -------------------------------------------------------------
  // Test 7: GET /payment/transaction/order/:orderId
  // -------------------------------------------------------------
  await test("Endpoint 7: GET /payment/transaction/order/:orderId (Look up by Order ID)", async () => {
    const res = await request(`/payment/transaction/order/${createdCfOrderId}`, { method: "GET" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.transactionId, createdTxnId);
    assert.strictEqual(res.data.gatewayOrderId, createdCfOrderId);
  });

  // -------------------------------------------------------------
  // Test 8: GET /payment/transactions/user/:userId
  // -------------------------------------------------------------
  await test("Endpoint 8: GET /payment/transactions/user/:userId (User transaction history)", async () => {
    const res = await request(`/payment/transactions/user/${testUser._id.toString()}`, { method: "GET" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.transactions));
    assert.ok(res.data.transactions.length >= 1);
  });

  // Cleanup test data
  await Bag.deleteMany({ userId: testUser._id });
  await Transaction.deleteOne({ transactionId: createdTxnId });
  await Order.deleteMany({ userId: testUser._id });

  server.close();
  await mongoose.disconnect();

  console.log("\n=======================================================");
  console.log(`  ALL ENDPOINTS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveEndpointTests().catch((err) => {
  console.error("Live endpoint test exception:", err);
  process.exit(1);
});

const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const PaymentRoutes = require("../routes/PaymentRoutes");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Bag = require("../models/Bag");
const { getCashfreeConfig } = require("../config/cashfree");

async function runRouteTests() {
  console.log("\n=======================================================");
  console.log("  RUNNING PAYMENT ROUTES & WEBHOOK END-TO-END TESTS    ");
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

  // Connect to DB for route tests
  await mongoose.connect(process.env.MONGO_URI);
  console.log("  [DB] Connected to MongoDB for route testing");

  await Transaction.deleteMany({ transactionId: { $regex: /^TXN_TEST_/ } });
  await Order.deleteMany({ shippingAddress: "TEST_ADDR_ROUTE" });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // Helper for requests
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

  // -------------------------------------------------------------
  // Test 1: Validation on POST /payment/cashfree/create-order
  // -------------------------------------------------------------
  await test("POST /payment/cashfree/create-order: Rejects missing userId", async () => {
    const res = await request("/payment/cashfree/create-order", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes("userId"));
  });

  await test("POST /payment/cashfree/create-order: Rejects empty bag", async () => {
    const dummyId = new mongoose.Types.ObjectId().toString();
    const res = await request("/payment/cashfree/create-order", {
      method: "POST",
      body: JSON.stringify({ userId: dummyId }),
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes("empty"));
  });

  // -------------------------------------------------------------
  // Test 2: Security check on Webhook signature verification
  // -------------------------------------------------------------
  await test("POST /payment/cashfree/webhook: Rejects invalid signature with 401", async () => {
    const res = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: {
        "x-webhook-signature": "invalid_fake_signature",
        "x-webhook-timestamp": "1693489200",
      },
      body: JSON.stringify({ data: { order: { order_id: "CF_101" } } }),
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test("POST /payment/cashfree/webhook: Accepts valid signature and processes success", async () => {
    const config = getCashfreeConfig();
    const secret = config.webhookSecret || "mock_secret";

    const testOrderId = `CF_TEST_ORD_${Date.now()}`;
    const testPaymentId = `cf_pay_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const webhookBody = {
      data: {
        order: {
          order_id: testOrderId,
          cf_order_id: `cf_order_${Date.now()}`,
          order_amount: 1299.0,
          order_currency: "INR",
        },
        payment: {
          cf_payment_id: testPaymentId,
          payment_status: "SUCCESS",
          payment_amount: 1299.0,
          payment_currency: "INR",
          payment_group: "upi",
          payment_time: new Date().toISOString(),
        },
        customer_details: {
          customer_id: "cust_test_1",
          customer_name: "Test Customer",
          customer_phone: "9876543210",
        },
      },
      event_time: new Date().toISOString(),
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const rawPayload = JSON.stringify(webhookBody);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}${rawPayload}`)
      .digest("base64");

    const res = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: {
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
      },
      body: rawPayload,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Verify Transaction was recorded in DB
    const txn = await Transaction.findOne({ gatewayPaymentId: testPaymentId });
    assert.ok(txn, "Transaction must be saved to DB");
    assert.strictEqual(txn.status, "SUCCESS");
    assert.strictEqual(txn.amount, 1299);
    assert.strictEqual(txn.paymentMethod, "upi");
    assert.ok(txn.webhookEvents.length > 0, "Webhook payload must be logged in audit trail");

    // Clean up
    await Transaction.deleteOne({ _id: txn._id });
  });

  // -------------------------------------------------------------
  // Test 3: Webhook Idempotency (Duplicate webhook handling)
  // -------------------------------------------------------------
  await test("POST /payment/cashfree/webhook: Idempotently handles duplicate webhook", async () => {
    const config = getCashfreeConfig();
    const secret = config.webhookSecret || "mock_secret";

    const testOrderId = `CF_IDEMP_${Date.now()}`;
    const testPaymentId = `cf_pay_idemp_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const webhookBody = {
      data: {
        order: { order_id: testOrderId, order_amount: 500 },
        payment: { cf_payment_id: testPaymentId, payment_status: "SUCCESS", payment_amount: 500 },
      },
      event_time: new Date().toISOString(),
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const rawPayload = JSON.stringify(webhookBody);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}${rawPayload}`)
      .digest("base64");

    // Send 1st time
    const res1 = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: { "x-webhook-signature": signature, "x-webhook-timestamp": timestamp },
      body: rawPayload,
    });
    assert.strictEqual(res1.status, 200);

    // Send 2nd time (Duplicate)
    const res2 = await request("/payment/cashfree/webhook", {
      method: "POST",
      headers: { "x-webhook-signature": signature, "x-webhook-timestamp": timestamp },
      body: rawPayload,
    });
    assert.strictEqual(res2.status, 200);

    // Count records in DB: must be exactly 1
    const count = await Transaction.countDocuments({ gatewayPaymentId: testPaymentId });
    assert.strictEqual(count, 1, "Duplicate webhook must not create duplicate transaction");

    await Transaction.deleteMany({ gatewayPaymentId: testPaymentId });
  });

  // -------------------------------------------------------------
  // Test 4: Transaction Lookup Endpoints
  // -------------------------------------------------------------
  await test("GET /payment/transaction/:id: Fetches transaction details safely", async () => {
    const txnId = `TXN_TEST_LOOKUP_${Date.now()}`;
    const newTxn = await new Transaction({
      transactionId: txnId,
      gateway: "CASHFREE",
      gatewayOrderId: "CF_LOOKUP_100",
      gatewayPaymentId: "PAY_LOOKUP_100",
      amount: 750,
      status: "SUCCESS",
      paymentMethod: "card",
      auditLog: [{ action: "INIT", note: "lookup test" }],
    }).save();

    const res = await request(`/payment/transaction/${txnId}`, { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.transactionId, txnId);
    assert.strictEqual(res.data.amount, 750);
    assert.strictEqual(res.data.status, "SUCCESS");
    assert.strictEqual(res.data.gateway, "CASHFREE");

    // Ensure no secrets leaked in response
    assert.strictEqual(res.data.secretKey, undefined);
    assert.strictEqual(res.data.appId, undefined);

    await Transaction.deleteOne({ _id: newTxn._id });
  });

  await test("GET /payment/transaction/order/:orderId: Fetches by order ID", async () => {
    const orderRef = new mongoose.Types.ObjectId();
    const txnId = `TXN_TEST_ORD_${Date.now()}`;
    const newTxn = await new Transaction({
      transactionId: txnId,
      orderId: orderRef,
      gateway: "CASHFREE",
      gatewayOrderId: "CF_ORD_REF_100",
      amount: 999,
      status: "SUCCESS",
    }).save();

    const res = await request(`/payment/transaction/order/${orderRef}`, { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.transactionId, txnId);
    assert.strictEqual(res.data.amount, 999);

    await Transaction.deleteOne({ _id: newTxn._id });
  });

  server.close();
  await mongoose.disconnect();

  console.log("\n=======================================================");
  console.log(`  ROUTE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runRouteTests().catch((err) => {
  console.error("Route test exception:", err);
  process.exit(1);
});

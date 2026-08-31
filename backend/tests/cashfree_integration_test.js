const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const {
  getCashfreeConfig,
  verifyCashfreeWebhookSignature,
} = require("../config/cashfree");
const { getPaymentGateway } = require("../services/paymentGateway");
const Transaction = require("../models/Transaction");
const Order = require("../models/Order");
const User = require("../models/User");
const Bag = require("../models/Bag");
const Product = require("../models/Product");

async function runTests() {
  console.log("\n=======================================================");
  console.log("  RUNNING CASHFREE PAYMENT GATEWAY INTEGRATION TESTS   ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${e.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
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

  // -------------------------------------------------------------
  // Test 1: Config and Environment Variable Fallbacks
  // -------------------------------------------------------------
  test("Config: Dual environment variable resolution works", () => {
    const config = getCashfreeConfig();
    assert.strictEqual(typeof config.env, "string");
    assert.strictEqual(typeof config.baseUrl, "string");
    assert.strictEqual(config.apiVersion, "2023-08-01");
    assert.ok(
      config.baseUrl === "https://sandbox.cashfree.com/pg" ||
      config.baseUrl === "https://api.cashfree.com/pg"
    );
  });

  // -------------------------------------------------------------
  // Test 2: Webhook HMAC-SHA256 Signature Verification
  // -------------------------------------------------------------
  test("Webhook: Valid signature is accepted", () => {
    const secret = "test_webhook_secret_key_12345";
    const timestamp = "1693489200";
    const rawBody = JSON.stringify({
      data: {
        order: { order_id: "CF_ORDER_101", order_amount: 599.0 },
        payment: { cf_payment_id: "pay_101", payment_status: "SUCCESS" },
      },
      event_time: "2026-08-31T19:00:00+05:30",
      type: "PAYMENT_SUCCESS_WEBHOOK",
    });

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}${rawBody}`)
      .digest("base64");

    const isValid = verifyCashfreeWebhookSignature(expectedSig, rawBody, timestamp, secret);
    assert.strictEqual(isValid, true, "Signature should be valid");
  });

  test("Webhook: Tampered signature is rejected", () => {
    const secret = "test_webhook_secret_key_12345";
    const timestamp = "1693489200";
    const rawBody = JSON.stringify({ order_id: "CF_ORDER_101" });
    const forgedSig = "aW52YWxpZF9zaWduYXR1cmVfZm9yZ2VkX2Jhc2U2NA==";

    const isValid = verifyCashfreeWebhookSignature(forgedSig, rawBody, timestamp, secret);
    assert.strictEqual(isValid, false, "Tampered signature should be rejected");
  });

  test("Webhook: Altered payload is rejected", () => {
    const secret = "test_webhook_secret_key_12345";
    const timestamp = "1693489200";
    const originalBody = JSON.stringify({ order_amount: 100 });
    const alteredBody = JSON.stringify({ order_amount: 1 });

    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}${originalBody}`)
      .digest("base64");

    const isValid = verifyCashfreeWebhookSignature(sig, alteredBody, timestamp, secret);
    assert.strictEqual(isValid, false, "Altered body signature should fail");
  });

  // -------------------------------------------------------------
  // Test 3: Payment Gateway Abstraction
  // -------------------------------------------------------------
  test("Gateway: Factory returns Cashfree and Razorpay adapters", () => {
    const cfGateway = getPaymentGateway("CASHFREE");
    assert.strictEqual(cfGateway.name, "CASHFREE");

    const rzpGateway = getPaymentGateway("RAZORPAY");
    assert.strictEqual(rzpGateway.name, "RAZORPAY");
  });

  test("Gateway: Parse Cashfree PG v2023-08-01 webhook payload", () => {
    const gateway = getPaymentGateway("CASHFREE");
    const payload = {
      data: {
        order: { order_id: "CF_ORD_999", cf_order_id: "123456", order_amount: 1499 },
        payment: {
          cf_payment_id: "pay_cf_888",
          payment_status: "SUCCESS",
          payment_amount: 1499,
          payment_currency: "INR",
          payment_group: "upi",
        },
      },
      event_time: "2026-08-31T19:00:00+05:30",
      type: "PAYMENT_SUCCESS_WEBHOOK",
    };

    const parsed = gateway.parseWebhookEvent(payload);
    assert.strictEqual(parsed.orderId, "CF_ORD_999");
    assert.strictEqual(parsed.cfOrderId, "123456");
    assert.strictEqual(parsed.paymentId, "pay_cf_888");
    assert.strictEqual(parsed.paymentStatus, "SUCCESS");
    assert.strictEqual(parsed.paymentAmount, 1499);
    assert.strictEqual(parsed.paymentMethod, "upi");
  });

  // -------------------------------------------------------------
  // Test 4: Database Models & Idempotency (if MongoDB available)
  // -------------------------------------------------------------
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("  [DB] Connected to MongoDB for model validation");

      await Transaction.deleteMany({ transactionId: { $regex: /^TXN_/ } });
      await Transaction.init();
      await Order.init();

      await asyncTest("Database: Transaction model schema validation and creation", async () => {
        const testTxnId = `TXN_TEST_${Date.now()}`;
        const txn = new Transaction({
          transactionId: testTxnId,
          gateway: "CASHFREE",
          gatewayOrderId: `CF_TEST_${Date.now()}`,
          gatewayPaymentId: `PAY_TEST_${Date.now()}`,
          amount: 899,
          currency: "INR",
          status: "PENDING",
          paymentMethod: "upi",
          auditLog: [
            {
              action: "ORDER_SESSION_CREATED",
              timestamp: new Date(),
              note: "Integration test initialization",
            },
          ],
          idempotencyKey: `idemp_${testTxnId}`,
        });

        const saved = await txn.save();
        assert.strictEqual(saved.transactionId, testTxnId);
        assert.strictEqual(saved.status, "PENDING");
        assert.strictEqual(saved.amount, 899);

        // Update status with audit log
        saved.status = "SUCCESS";
        saved.auditLog.push({ action: "PAYMENT_VERIFIED", note: "Verified in test" });
        await saved.save();

        const updated = await Transaction.findOne({ transactionId: testTxnId });
        assert.strictEqual(updated.status, "SUCCESS");
        assert.strictEqual(updated.auditLog.length, 2);

        // Clean up test document
        await Transaction.deleteOne({ _id: saved._id });
      });

      await asyncTest("Database: Duplicate transaction idempotency guard", async () => {
        const duplicateTxnId = `TXN_DUP_${Date.now()}`;
        const txn1 = new Transaction({
          transactionId: duplicateTxnId,
          gateway: "CASHFREE",
          amount: 500,
          status: "SUCCESS",
        });
        await txn1.save();

        let duplicateCaught = false;
        try {
          const txn2 = new Transaction({
            transactionId: duplicateTxnId,
            gateway: "CASHFREE",
            amount: 500,
            status: "SUCCESS",
          });
          await txn2.save();
        } catch (e) {
          duplicateCaught = true;
        }

        assert.strictEqual(duplicateCaught, true, "Duplicate transactionId must be rejected by unique index");
        await Transaction.deleteOne({ _id: txn1._id });
      });

      await mongoose.disconnect();
    } catch (dbErr) {
      console.log("  [DB] Skipped live DB model tests (Mongo connection issue):", dbErr.message);
    }
  }

  console.log("\n=======================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner exception:", err);
  process.exit(1);
});

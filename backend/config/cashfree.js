const crypto = require("crypto");

const CASHFREE_ENV = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST_APP_ID";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "TEST_SECRET_KEY";
const API_VERSION = "2023-08-01";

const BASE_URL =
  CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/**
 * Helper to make authenticated Cashfree PG API requests
 */
async function cashfreeRequest(endpoint, method = "GET", body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "x-client-id": CASHFREE_APP_ID,
    "x-client-secret": CASHFREE_SECRET_KEY,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const options = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Cashfree API error (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Create Cashfree PG Order
 */
async function createCashfreeOrder({
  orderId,
  orderAmount,
  customerDetails,
  returnUrl,
  notifyUrl,
}) {
  const isMockCredentials =
    !process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_APP_ID.includes("TEST_") ||
    process.env.CASHFREE_APP_ID === "your_payment_gateway_key_id";

  if (isMockCredentials) {
    console.log("[Cashfree Sandbox] Using simulated Cashfree order session for development testing");
    const mockSessionId = `session_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      orderId: orderId,
      paymentSessionId: mockSessionId,
      orderStatus: "ACTIVE",
      orderAmount: orderAmount,
      orderCurrency: "INR",
      environment: CASHFREE_ENV,
      isSimulated: true,
    };
  }

  const payload = {
    order_id: orderId,
    order_amount: orderAmount,
    order_currency: "INR",
    customer_details: {
      customer_id: customerDetails.customerId || "cust_guest",
      customer_name: customerDetails.customerName || "Customer",
      customer_email: customerDetails.customerEmail || "customer@example.com",
      customer_phone: customerDetails.customerPhone || "9999999999",
    },
    order_meta: {
      return_url: returnUrl || `https://myntra.com/orders?order_id={order_id}`,
      notify_url: notifyUrl,
    },
  };

  const result = await cashfreeRequest("/orders", "POST", payload);

  return {
    orderId: result.order_id,
    paymentSessionId: result.payment_session_id,
    orderStatus: result.order_status,
    orderAmount: result.order_amount,
    orderCurrency: result.order_currency,
    environment: CASHFREE_ENV,
    raw: result,
  };
}

/**
 * Fetch Order Status from Cashfree
 */
async function getCashfreeOrder(orderId) {
  const isMock =
    !process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_APP_ID.includes("TEST_") ||
    process.env.CASHFREE_APP_ID === "your_payment_gateway_key_id";

  if (isMock || orderId.startsWith("cf_sim_") || orderId.includes("mock")) {
    return {
      order_id: orderId,
      order_status: "PAID",
      order_amount: 0,
      isSimulated: true,
    };
  }

  return await cashfreeRequest(`/orders/${orderId}`, "GET");
}

/**
 * Fetch Order Payments from Cashfree
 */
async function getCashfreeOrderPayments(orderId) {
  const isMock =
    !process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_APP_ID.includes("TEST_") ||
    process.env.CASHFREE_APP_ID === "your_payment_gateway_key_id";

  if (isMock || orderId.startsWith("cf_sim_") || orderId.includes("mock")) {
    return [
      {
        payment_id: `pay_mock_${Date.now()}`,
        payment_status: "SUCCESS",
        payment_amount: 0,
        payment_method: { card: { channel: "visa" } },
      },
    ];
  }

  return await cashfreeRequest(`/orders/${orderId}/payments`, "GET");
}

/**
 * Verify Webhook Signature using HMAC SHA256
 */
function verifyCashfreeWebhookSignature(signature, rawBody, timestamp) {
  try {
    const data = `${timestamp}${rawBody}`;
    const generatedSignature = crypto
      .createHmac("sha256", CASHFREE_SECRET_KEY)
      .update(data)
      .digest("base64");
    return generatedSignature === signature;
  } catch (e) {
    console.error("Webhook signature verification error:", e);
    return false;
  }
}

module.exports = {
  CASHFREE_ENV,
  CASHFREE_APP_ID,
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
};

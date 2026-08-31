const crypto = require("crypto");

/**
 * Cashfree Payment Gateway Configuration
 * Supports both generic PAYMENT_GATEWAY_* and provider-specific CASHFREE_* environment variables.
 */
function getCashfreeConfig() {
  const env = (
    process.env.PAYMENT_GATEWAY_ENVIRONMENT ||
    process.env.CASHFREE_ENVIRONMENT ||
    "SANDBOX"
  ).toUpperCase();

  const appId =
    process.env.PAYMENT_GATEWAY_KEY_ID ||
    process.env.CASHFREE_APP_ID ||
    "";

  const secretKey =
    process.env.PAYMENT_GATEWAY_KEY_SECRET ||
    process.env.CASHFREE_SECRET_KEY ||
    "";

  const webhookSecret =
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.CASHFREE_WEBHOOK_SECRET ||
    secretKey;

  const baseUrl =
    env === "PRODUCTION"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

  const apiVersion = "2023-08-01";

  return {
    env,
    appId,
    secretKey,
    webhookSecret,
    baseUrl,
    apiVersion,
    isConfigured: Boolean(appId && secretKey),
  };
}

/**
 * Helper to make authenticated Cashfree PG API requests
 * Safely handles and masks credentials in diagnostics.
 */
async function cashfreeRequest(endpoint, method = "GET", body = null) {
  const config = getCashfreeConfig();

  if (!config.isConfigured) {
    const err = new Error("Cashfree API credentials are not configured in environment variables.");
    err.status = 500;
    err.code = "CONFIG_MISSING";
    throw err;
  }

  const url = `${config.baseUrl}${endpoint}`;
  const headers = {
    "x-client-id": config.appId,
    "x-client-secret": config.secretKey,
    "x-api-version": config.apiVersion,
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

  let response;
  try {
    response = await fetch(url, options);
  } catch (netErr) {
    console.error(`[Cashfree API] Network request failed to ${endpoint}:`, netErr.message);
    const error = new Error(`Cashfree network failure: ${netErr.message}`);
    error.status = 502;
    error.code = "NETWORK_ERROR";
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Log safe diagnostic info without exposing headers or secrets
    console.error(
      `[Cashfree PG API Error] Endpoint: ${endpoint} | HTTP Status: ${response.status} | Code: ${data.code || data.type || "UNKNOWN"} | Message: ${data.message || response.statusText}`
    );

    const error = new Error(
      data.message || `Cashfree API request failed with status ${response.status}`
    );
    error.status = response.status;
    error.code = data.code || data.type || "CASHFREE_API_ERROR";
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Create Cashfree PG Order
 * API version: 2023-08-01
 */
async function createCashfreeOrder({
  orderId,
  orderAmount,
  customerDetails,
  returnUrl,
  notifyUrl,
  orderNote,
}) {
  const config = getCashfreeConfig();

  // Cashfree requires amount to have at most 2 decimal places and minimum 1.00 INR
  const sanitizedAmount = parseFloat(Number(orderAmount).toFixed(2));
  if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
    throw new Error("Order amount must be a positive number");
  }

  // Format customer phone safely (10 digits)
  const phone = (customerDetails.customerPhone || "").replace(/\D/g, "").slice(-10) || "9999999999";

  const payload = {
    order_id: orderId,
    order_amount: sanitizedAmount,
    order_currency: "INR",
    customer_details: {
      customer_id: customerDetails.customerId || `cust_${Date.now()}`,
      customer_name: customerDetails.customerName || "Customer",
      customer_email: customerDetails.customerEmail || "customer@example.com",
      customer_phone: phone,
    },
    order_meta: {
      return_url: returnUrl || undefined,
      notify_url: notifyUrl || undefined,
    },
  };

  if (orderNote) {
    payload.order_note = orderNote;
  }

  const result = await cashfreeRequest("/orders", "POST", payload);

  return {
    orderId: result.order_id,
    cfOrderId: result.cf_order_id,
    paymentSessionId: result.payment_session_id,
    orderStatus: result.order_status,
    orderAmount: result.order_amount,
    orderCurrency: result.order_currency,
    environment: config.env,
    raw: result,
  };
}

/**
 * Fetch Order Status from Cashfree
 */
async function getCashfreeOrder(orderId) {
  return await cashfreeRequest(`/orders/${orderId}`, "GET");
}

/**
 * Fetch Order Payments from Cashfree
 */
async function getCashfreeOrderPayments(orderId) {
  return await cashfreeRequest(`/orders/${orderId}/payments`, "GET");
}

/**
 * Verify Webhook Signature using HMAC-SHA256 and constant-time buffer comparison.
 * Cashfree signature payload is: `${timestamp}${rawBody}`
 */
function verifyCashfreeWebhookSignature(signature, rawBody, timestamp, customSecret) {
  if (!signature || !timestamp || rawBody === undefined || rawBody === null) {
    return false;
  }

  try {
    const config = getCashfreeConfig();
    const secret = customSecret || config.webhookSecret;

    if (!secret) {
      console.warn("[Cashfree Webhook] Webhook secret not configured");
      return false;
    }

    const payload = `${timestamp}${rawBody}`;
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("base64");

    const sigBuffer = Buffer.from(signature, "utf8");
    const genBuffer = Buffer.from(generatedSignature, "utf8");

    if (sigBuffer.length !== genBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, genBuffer);
  } catch (e) {
    console.error("[Cashfree Webhook] Signature verification error:", e.message);
    return false;
  }
}

module.exports = {
  getCashfreeConfig,
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
};

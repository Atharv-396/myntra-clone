const {
  getCashfreeConfig,
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
} = require("../config/cashfree");

/**
 * Cashfree Payment Gateway Adapter
 */
class CashfreeGateway {
  constructor() {
    this.name = "CASHFREE";
  }

  isConfigured() {
    return getCashfreeConfig().isConfigured;
  }

  async createOrder({ orderId, orderAmount, customerDetails, returnUrl, notifyUrl, orderNote }) {
    return await createCashfreeOrder({
      orderId,
      orderAmount,
      customerDetails,
      returnUrl,
      notifyUrl,
      orderNote,
    });
  }

  async getOrder(orderId) {
    return await getCashfreeOrder(orderId);
  }

  async getPayments(orderId) {
    return await getCashfreeOrderPayments(orderId);
  }

  verifyWebhookSignature({ signature, timestamp, rawBody, secret }) {
    return verifyCashfreeWebhookSignature(signature, rawBody, timestamp, secret);
  }

  parseWebhookEvent(body) {
    // Cashfree PG API v2023-08-01 format
    if (body && body.data) {
      const order = body.data.order || {};
      const payment = body.data.payment || {};
      const customer = body.data.customer_details || {};
      return {
        eventType: body.type || "PAYMENT_WEBHOOK",
        eventTime: body.event_time ? new Date(body.event_time) : new Date(),
        orderId: order.order_id,
        cfOrderId: order.cf_order_id,
        orderAmount: order.order_amount,
        paymentId: payment.cf_payment_id,
        paymentStatus: payment.payment_status, // SUCCESS, FAILED, USER_DROPPED
        paymentAmount: payment.payment_amount,
        paymentCurrency: payment.payment_currency || "INR",
        paymentMethod: payment.payment_group || "UNKNOWN",
        customerId: customer.customer_id,
        customerPhone: customer.customer_phone,
        raw: body,
      };
    }

    // Root-level fallback
    return {
      eventType: body.type || body.txStatus || "PAYMENT_WEBHOOK",
      eventTime: new Date(),
      orderId: body.orderId || body.order_id,
      cfOrderId: body.referenceId || body.cf_order_id,
      orderAmount: parseFloat(body.orderAmount || body.order_amount || 0),
      paymentId: body.referenceId || body.paymentId || body.cf_payment_id,
      paymentStatus: body.txStatus === "SUCCESS" ? "SUCCESS" : body.txStatus || "UNKNOWN",
      paymentAmount: parseFloat(body.orderAmount || body.order_amount || 0),
      paymentCurrency: "INR",
      paymentMethod: body.paymentMode || "UNKNOWN",
      customerId: body.customer_id,
      customerPhone: body.customerPhone,
      raw: body,
    };
  }
}

/**
 * Razorpay Gateway Adapter (Placeholder for multi-gateway architecture)
 */
class RazorpayGateway {
  constructor() {
    this.name = "RAZORPAY";
  }

  isConfigured() {
    const keyId = process.env.PAYMENT_GATEWAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.PAYMENT_GATEWAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
    return Boolean(keyId && keySecret);
  }

  async createOrder({ orderId, orderAmount, customerDetails }) {
    throw new Error("Razorpay integration configured via standard gateway interface.");
  }

  async getOrder(orderId) {
    throw new Error("Razorpay getOrder not implemented.");
  }

  verifyWebhookSignature() {
    return false;
  }

  parseWebhookEvent(body) {
    return {
      eventType: body.event || "UNKNOWN",
      eventTime: new Date(),
      orderId: body.payload?.payment?.entity?.order_id,
      paymentId: body.payload?.payment?.entity?.id,
      paymentStatus: body.payload?.payment?.entity?.status === "captured" ? "SUCCESS" : "FAILED",
      raw: body,
    };
  }
}

/**
 * Factory to get active payment gateway
 */
function getPaymentGateway(gatewayName) {
  const selected = (
    gatewayName ||
    process.env.PAYMENT_GATEWAY ||
    "CASHFREE"
  ).toUpperCase();

  if (selected === "RAZORPAY") {
    return new RazorpayGateway();
  }

  return new CashfreeGateway();
}

module.exports = {
  CashfreeGateway,
  RazorpayGateway,
  getPaymentGateway,
};

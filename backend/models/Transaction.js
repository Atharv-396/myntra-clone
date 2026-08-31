const mongoose = require("mongoose");

const WebhookEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    eventTime: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const TransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      sparse: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    gateway: {
      type: String,
      enum: ["CASHFREE", "RAZORPAY", "COD", "OTHER"],
      default: "CASHFREE",
      index: true,
    },
    gatewayOrderId: {
      type: String,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    paymentSessionId: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "USER_DROPPED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "UNKNOWN",
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    webhookEvents: [WebhookEventSchema],
    auditLog: [AuditLogSchema],
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

// Helpful indices for fast lookups and transaction auditing
TransactionSchema.index({ gateway: 1, gatewayOrderId: 1 });
TransactionSchema.index({ gateway: 1, gatewayPaymentId: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, default: "" }, // which device this was sent to

    category: { type: String, required: true }, // ORDER, PAYMENT, SHIPPING, etc.
    type:     { type: String, required: true }, // ORDER_CONFIRMED, PAYMENT_SUCCESS, etc.
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    data:     { type: mongoose.Schema.Types.Mixed, default: {} }, // navigation payload

    status:            { type: String, enum: ["PENDING","SENT","DELIVERED","FAILED","READ"], default: "PENDING" },
    expoTicketId:      { type: String, default: "" },
    expoReceiptStatus: { type: String, default: "" },
    errorCode:         { type: String, default: "" },
    errorMessage:      { type: String, default: "" },

    // Idempotency key — prevents duplicate notifications for the same event
    idempotencyKey: { type: String, default: "" },

    sentAt:      { type: Date },
    deliveredAt: { type: Date },
    readAt:      { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ category: 1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expoTicketId: 1 });
NotificationSchema.index({ idempotencyKey: 1 }, { sparse: true });

module.exports = mongoose.model("Notification", NotificationSchema);

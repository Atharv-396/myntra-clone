const mongoose = require("mongoose");
const TimelineSchema = new mongoose.Schema({
  status: String,
  location: String,
  timestamp: String,
});
const TrackingSchema = new mongoose.Schema({
  number: String,
  carrier: String,
  estimatedDelivery: String,
  currentLocation: String,
  status: String,
  timeline: [TimelineSchema],
});
const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  size: String,
  color: { type: String, default: "" },
  price: Number,
  quantity: Number,
});
const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: String,
    status: String,
    items: [OrderItemSchema],
    total: Number,
    shippingAddress: String,
    paymentMethod: String,
    paymentStatus: { type: String, default: "Pending" },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    cashfreeOrderId: String,
    cashfreePaymentId: String,
    paymentSessionId: String,
    tracking: TrackingSchema,
    // Cancellation fields
    cancellationReason: { type: String, default: "" },
    cancelledAt: { type: Date },
    // Return fields
    returnStatus: { type: String, enum: ["", "Requested", "Approved", "Rejected", "Completed"], default: "" },
    returnReason: { type: String, default: "" },
    returnRequestedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);

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
    tracking: TrackingSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);

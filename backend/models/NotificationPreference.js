const mongoose = require("mongoose");

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one preference doc per user
    },
    orderNotifications:    { type: Boolean, default: true },
    paymentNotifications:  { type: Boolean, default: true },
    shippingNotifications: { type: Boolean, default: true },
    deliveryNotifications: { type: Boolean, default: true },
    wishlistNotifications: { type: Boolean, default: true },
    stockNotifications:    { type: Boolean, default: true },
    promotionNotifications:{ type: Boolean, default: true },
    cartNotifications:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationPreference", NotificationPreferenceSchema);

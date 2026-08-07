const mongoose = require("mongoose");

// Extended Bag model — backward compatible with existing data
// New fields: color (optional), priceAtAdd (snapshot), savedForLater flag
const BagItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    size: { type: String, required: true },
    color: { type: String, default: "" },          // optional variant
    quantity: { type: Number, default: 1, min: 1 },
    priceAtAdd: { type: Number, default: 0 },       // price snapshot at time of add
    savedForLater: { type: Boolean, default: false }, // false = in cart, true = saved for later
    unavailable: { type: Boolean, default: false },  // marked true if product no longer valid
    unavailableReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index: prevents duplicate items (same product+size+color per user)
// Used by upsert logic in the add-to-cart route
BagItemSchema.index(
  { userId: 1, productId: 1, size: 1, color: 1, savedForLater: 1 },
  { name: "unique_cart_item" }
);

module.exports = mongoose.model("Bag", BagItemSchema);

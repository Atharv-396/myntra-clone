const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    brand: String,
    price: Number,
    discount: String,
    description: String,
    sizes: [String],
    images: [String],
    // New fields — backward compatible (existing docs will have these as undefined/defaults)
    stock: { type: Number, default: 100 },          // default 100 so existing products work
    maxPerOrder: { type: Number, default: 10 },      // max quantity per order
    active: { type: Boolean, default: true },        // soft-delete / disable support
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);

const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    name: String,
    subcategory: [String],
    image: String,
    productId: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);

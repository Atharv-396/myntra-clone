const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Wishlist = require("../models/Wishlist");
const router = express.Router();
const { sendNotification, sendToMultipleUsers } = require("../services/notificationService");
const { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } = require("../constants/notificationTypes");

router.get("/", async (req, res) => {
  try {
    const categories = await Product.find();
    res.status(200).json(categories);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/:id", async (req, res) => {
  const productid = req.params.id;
  try {
    const product = await Product.findById(productid);
    res.status(200).json(product);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * PATCH /product/:id/price
 * Update a product's price. Triggers wishlist price-drop notifications if price decreased.
 * Body: { newPrice }
 */
router.patch("/:id/price", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid product ID" });
    if (typeof newPrice !== "number" || newPrice <= 0)
      return res.status(400).json({ message: "newPrice must be a positive number" });

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const oldPrice = product.price;
    product.price = newPrice;
    await product.save();

    // Trigger price-drop notifications only when price decreases
    if (newPrice < oldPrice) {
      const idempotencyKey = `price_drop:${id}:${oldPrice}:${newPrice}`;

      // Find all users who have this product wishlisted
      const wishlistItems = await Wishlist.find({ productId: id }).lean();
      const userIds = [...new Set(wishlistItems.map((w) => w.userId.toString()))];

      if (userIds.length > 0) {
        sendToMultipleUsers(userIds, {
          category: NOTIFICATION_CATEGORIES.WISHLIST,
          type: NOTIFICATION_TYPES.WISHLIST_PRICE_DROP,
          title: "Price Drop Alert 🔥",
          body: `A product from your wishlist is now ₹${newPrice} (was ₹${oldPrice}).`,
          data: { type: "WISHLIST_PRICE_DROP", category: "WISHLIST", productId: id },
          idempotencyKey,
        }).catch(() => {});
      }
    }

    return res.status(200).json({ message: "Price updated", oldPrice, newPrice });
  } catch (error) {
    console.log("PATCH /product/:id/price error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * PATCH /product/:id/stock
 * Update product stock. Triggers back-in-stock notifications if stock was 0 → >0.
 * Body: { stock }
 */
router.patch("/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid product ID" });
    if (typeof stock !== "number" || stock < 0)
      return res.status(400).json({ message: "stock must be a non-negative number" });

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const wasOutOfStock = (product.stock || 0) === 0;
    const nowInStock = stock > 0;
    product.stock = stock;
    await product.save();

    // Trigger back-in-stock notifications only when restocked
    if (wasOutOfStock && nowInStock) {
      const idempotencyKey = `back_in_stock:${id}:${Date.now()}`;

      // Notify users who wishlisted this product
      const wishlistItems = await Wishlist.find({ productId: id }).lean();
      const userIds = [...new Set(wishlistItems.map((w) => w.userId.toString()))];

      if (userIds.length > 0) {
        sendToMultipleUsers(userIds, {
          category: NOTIFICATION_CATEGORIES.STOCK,
          type: NOTIFICATION_TYPES.PRODUCT_BACK_IN_STOCK,
          title: "Back In Stock 🎉",
          body: `${product.name} is available again!`,
          data: { type: "PRODUCT_BACK_IN_STOCK", category: "STOCK", productId: id },
          idempotencyKey,
        }).catch(() => {});
      }
    }

    return res.status(200).json({ message: "Stock updated", stock });
  } catch (error) {
    console.log("PATCH /product/:id/stock error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;

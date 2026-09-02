const express = require("express");
const mongoose = require("mongoose");
const Bag = require("../models/Bag");
const Product = require("../models/Product");
const router = express.Router();

// IMPORTANT: Express matches routes in order of definition.
// Specific literal paths (e.g. /merge, /validate, /clear/:id, /totals/:id)
// MUST be defined BEFORE parameterized paths (e.g. /:itemid, /:userid)
// to prevent Express from matching "merge" or "validate" as an itemid/userid.

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — calculate cart totals from populated items
// ─────────────────────────────────────────────────────────────────────────────
function calculateTotals(items) {
  let subtotal = 0;
  let itemCount = 0;
  const priceChanges = [];
  for (const item of items) {
    if (item.savedForLater || item.unavailable) continue;
    const product = item.productId;
    if (!product) continue;
    const currentPrice = product.price || 0;
    subtotal += currentPrice * item.quantity;
    itemCount += item.quantity;
    if (item.priceAtAdd && item.priceAtAdd !== currentPrice) {
      priceChanges.push({ itemId: item._id, productName: product.name, oldPrice: item.priceAtAdd, newPrice: currentPrice, priceChanged: true });
    }
  }
  const shipping = subtotal > 0 && subtotal < 999 ? 99 : 0;
  return { subtotal, shipping, grandTotal: subtotal + shipping, itemCount, priceChanges };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /bag — add item (upsert, price snapshot, validation)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { userId, productId, size, color = "", quantity = 1 } = req.body;
    if (!userId || !productId || !size) return res.status(400).json({ message: "userId, productId and size are required" });
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: "Invalid userId or productId" });

    const product = await Product.findById(productId);
    if (!product || product.active === false) return res.status(404).json({ message: "Product not found or unavailable" });
    if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(size))
      return res.status(400).json({ message: `Size "${size}" is not available for this product` });

    const qty = Math.max(1, parseInt(quantity) || 1);
    const maxQty = product.maxPerOrder || 10;
    if (qty > maxQty) return res.status(400).json({ message: `Maximum ${maxQty} units allowed per order` });
    if (product.stock !== undefined && qty > product.stock)
      return res.status(400).json({ message: "Requested quantity exceeds available stock", availableStock: product.stock });

    const existing = await Bag.findOne({ userId, productId, size, color, savedForLater: false });
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, maxQty);
      existing.unavailable = false;
      existing.unavailableReason = "";
      const updated = await existing.save();
      return res.status(200).json(await updated.populate("productId"));
    }

    const saved = await new Bag({ userId, productId, size, color, quantity: qty, priceAtAdd: product.price, savedForLater: false }).save();
    return res.status(201).json(await saved.populate("productId"));
  } catch (error) {
    console.log("POST /bag error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /bag/merge — merge guest cart after login (BEFORE /:itemid)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/merge", async (req, res) => {
  try {
    const { userId, items } = req.body;
    if (!userId || !Array.isArray(items)) return res.status(400).json({ message: "userId and items array are required" });
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid userId" });

    const results = [];
    for (const guestItem of items) {
      const { productId, size, color = "", quantity = 1 } = guestItem;
      if (!productId || !size || !mongoose.Types.ObjectId.isValid(productId)) continue;
      const product = await Product.findById(productId);
      if (!product || product.active === false) continue;
      const maxQty = product.maxPerOrder || 10;
      const existing = await Bag.findOne({ userId, productId, size, color, savedForLater: false });
      if (existing) {
        existing.quantity = Math.min(existing.quantity + parseInt(quantity), maxQty);
        await existing.save();
        results.push({ merged: true, productId });
      } else {
        await Bag.create({ userId, productId, size, color, quantity: Math.min(parseInt(quantity) || 1, maxQty), priceAtAdd: product.price, savedForLater: false });
        results.push({ added: true, productId });
      }
    }
    res.status(200).json({ message: "Cart merged", results });
  } catch (error) {
    console.log("POST /bag/merge error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /bag/validate — validate cart before checkout (BEFORE /:itemid)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/validate", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: "Valid userId is required" });

    const items = await Bag.find({ userId, savedForLater: false }).populate("productId");
    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" });

    const valid = [], invalid = [], warnings = [], priceChanges = [];
    for (const item of items) {
      const product = item.productId;
      if (!product || product.active === false) {
        await Bag.findByIdAndUpdate(item._id, { unavailable: true, unavailableReason: !product ? "Product no longer exists" : "Product is currently unavailable" });
        invalid.push({ itemId: item._id, productName: product ? product.name : "Unknown", reason: !product ? "Product no longer exists" : "Product is currently unavailable" });
        continue;
      }
      if (product.stock !== undefined && item.quantity > product.stock) {
        warnings.push({ itemId: item._id, productName: product.name, requestedQty: item.quantity, availableStock: product.stock, message: `Only ${product.stock} units available` });
      }
      if (item.priceAtAdd && item.priceAtAdd !== product.price) {
        priceChanges.push({ itemId: item._id, productName: product.name, oldPrice: item.priceAtAdd, newPrice: product.price, priceChanged: true });
        await Bag.findByIdAndUpdate(item._id, { priceAtAdd: product.price });
      }
      valid.push(item);
    }
    const totals = calculateTotals(valid);
    return res.status(200).json({ canCheckout: invalid.length === 0 && warnings.length === 0, totals, priceChanges, warnings, invalidItems: invalid });
  } catch (error) {
    console.log("POST /bag/validate error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /bag/save-for-later/:itemid (BEFORE generic /:itemid DELETE)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/save-for-later/:itemid", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemid)) return res.status(400).json({ message: "Invalid item ID" });
    const item = await Bag.findById(req.params.itemid);
    if (!item) return res.status(404).json({ message: "Cart item not found" });
    if (item.savedForLater) return res.status(400).json({ message: "Item is already saved for later" });
    item.savedForLater = true;
    const updated = await item.save();
    return res.status(200).json(await updated.populate("productId"));
  } catch (error) {
    console.log("POST /bag/save-for-later error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /bag/move-to-cart/:itemid (BEFORE generic /:itemid)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/move-to-cart/:itemid", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemid)) return res.status(400).json({ message: "Invalid item ID" });
    const item = await Bag.findById(req.params.itemid).populate("productId");
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (!item.savedForLater) return res.status(400).json({ message: "Item is already in cart" });

    const existing = await Bag.findOne({ userId: item.userId, productId: item.productId._id || item.productId, size: item.size, color: item.color, savedForLater: false });
    if (existing) {
      const maxQty = (item.productId && item.productId.maxPerOrder) || 10;
      existing.quantity = Math.min(existing.quantity + item.quantity, maxQty);
      await existing.save();
      await Bag.findByIdAndDelete(item._id);
      return res.status(200).json(await existing.populate("productId"));
    }
    item.savedForLater = false;
    item.unavailable = false;
    item.unavailableReason = "";
    const updated = await item.save();
    return res.status(200).json(await updated.populate("productId"));
  } catch (error) {
    console.log("POST /bag/move-to-cart error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /bag/totals/:userid — MUST be before GET /:userid
// ─────────────────────────────────────────────────────────────────────────────
router.get("/totals/:userid", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userid)) return res.status(400).json({ message: "Invalid userId" });
    const items = await Bag.find({ userId: req.params.userid, savedForLater: false, unavailable: false }).populate("productId");
    return res.status(200).json(calculateTotals(items));
  } catch (error) {
    console.log("GET /bag/totals error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bag/clear/:userid — MUST be before DELETE /:itemid
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/clear/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    const result = await Bag.deleteMany({ userId: userid, savedForLater: false });
    res.status(200).json({ message: "Cart cleared", deletedCount: result.deletedCount });
  } catch (error) {
    console.log("DELETE /bag/clear error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /bag/:itemid — update quantity
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:itemid", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemid)) return res.status(400).json({ message: "Invalid item ID" });
    const qty = parseInt(req.body.quantity);
    if (isNaN(qty) || qty < 1) return res.status(400).json({ message: "Quantity must be at least 1" });

    const item = await Bag.findById(req.params.itemid).populate("productId");
    if (!item) return res.status(404).json({ message: "Cart item not found" });
    const product = item.productId;
    const maxQty = (product && product.maxPerOrder) || 10;
    const stock = (product && product.stock) || 100;
    if (qty > maxQty) return res.status(400).json({ message: `Maximum ${maxQty} units per order` });
    if (qty > stock) return res.status(400).json({ message: "Requested quantity exceeds available stock", availableStock: stock });

    item.quantity = qty;
    return res.status(200).json(await item.save());
  } catch (error) {
    console.log("PATCH /bag/:itemid error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bag/:itemid — remove single item (AFTER /clear/:userid)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:itemid", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.itemid)) return res.status(400).json({ message: "Invalid item ID" });
    await Bag.findByIdAndDelete(req.params.itemid);
    res.status(200).json({ message: "Item removed from bag" });
  } catch (error) {
    console.log("DELETE /bag/:itemid error:", error);
    return res.status(500).json({ message: "Error removing item from bag" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /bag/:userid — get all items (AFTER /totals/:userid)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userid", async (req, res) => {
  try {
    const items = await Bag.find({ userId: req.params.userid }).populate("productId");
    res.status(200).json(items);
  } catch (error) {
    console.log("GET /bag/:userid error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;

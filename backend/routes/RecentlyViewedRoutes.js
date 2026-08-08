const express = require("express");
const mongoose = require("mongoose");
const RecentlyViewed = require("../models/RecentlyViewed");
const Order = require("../models/Order");
const router = express.Router();

const MAX_HISTORY = 50; // extended from 20 to support recommendation engine

// POST /recently-viewed
// Add a product to recently viewed. Handles:
// - Removing duplicate (if already viewed)
// - Inserting as newest (pushed to end of array)
// - Capping at MAX_HISTORY items (removes oldest)
router.post("/", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ message: "userId and productId are required" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({ message: "Invalid userId or productId" });
    }

    // Find or create the history document for this user
    let history = await RecentlyViewed.findOne({ userId });

    if (!history) {
      history = new RecentlyViewed({ userId, products: [] });
    }

    // Remove existing entry for this product (prevent duplicate)
    history.products = history.products.filter(
      (p) => p.productId.toString() !== productId.toString()
    );

    // Push as newest viewed product
    history.products.push({ productId, viewedAt: new Date() });

    // Cap at MAX_HISTORY — remove oldest (front of array)
    if (history.products.length > MAX_HISTORY) {
      history.products = history.products.slice(history.products.length - MAX_HISTORY);
    }

    await history.save();
    res.status(200).json({ message: "Recently viewed updated" });
  } catch (error) {
    console.log("RecentlyViewed POST error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /recently-viewed/:userId
// Returns recently viewed products, newest first, populated with product data
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const history = await RecentlyViewed.findOne({ userId }).populate(
      "products.productId"
    );

    if (!history) {
      return res.status(200).json([]); // no history yet — return empty array
    }

    // Return newest first, filter out any null populated products
    const result = history.products
      .filter((p) => p.productId !== null)
      .reverse()
      .map((p) => ({
        _id: p._id,
        product: p.productId,
        viewedAt: p.viewedAt,
      }));

    res.status(200).json(result);
  } catch (error) {
    console.log("RecentlyViewed GET error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /recently-viewed/:userId/continue-shopping
// Returns products viewed but NOT purchased — for "Continue Shopping" section
router.get("/:userId/continue-shopping", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // Get all products the user has ordered
    const orders = await Order.find({ userId });
    const purchasedProductIds = new Set(
      orders.flatMap((order) =>
        order.items.map((item) => item.productId.toString())
      )
    );

    // Get recently viewed history
    const history = await RecentlyViewed.findOne({ userId }).populate(
      "products.productId"
    );

    if (!history) {
      return res.status(200).json([]);
    }

    // Filter out purchased products
    const result = history.products
      .filter(
        (p) =>
          p.productId !== null &&
          !purchasedProductIds.has(p.productId._id.toString())
      )
      .reverse()
      .map((p) => ({
        _id: p._id,
        product: p.productId,
        viewedAt: p.viewedAt,
      }));

    res.status(200).json(result);
  } catch (error) {
    console.log("Continue shopping GET error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /recently-viewed/merge
// Merge guest (local) history into MongoDB after login
// Body: { userId, localHistory: [{ productId, viewedAt }] }
router.post("/merge", async (req, res) => {
  try {
    const { userId, localHistory } = req.body;

    if (!userId || !Array.isArray(localHistory)) {
      return res.status(400).json({ message: "userId and localHistory array are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    let history = await RecentlyViewed.findOne({ userId });
    if (!history) {
      history = new RecentlyViewed({ userId, products: [] });
    }

    // Merge: combine DB history + local history
    // Build a map keyed by productId — last write wins (preserves newest viewedAt)
    const mergedMap = new Map();

    // Add DB history first (older)
    for (const p of history.products) {
      mergedMap.set(p.productId.toString(), {
        productId: p.productId,
        viewedAt: p.viewedAt,
      });
    }

    // Add local history (may be newer — overwrites if duplicate)
    for (const p of localHistory) {
      if (p.productId && mongoose.Types.ObjectId.isValid(p.productId)) {
        mergedMap.set(p.productId.toString(), {
          productId: p.productId,
          viewedAt: new Date(p.viewedAt || Date.now()),
        });
      }
    }

    // Sort by viewedAt ascending (oldest first), then cap at MAX_HISTORY
    const sorted = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.viewedAt).getTime() - new Date(b.viewedAt).getTime()
    );

    history.products = sorted.slice(-MAX_HISTORY);
    await history.save();

    res.status(200).json({ message: "History merged successfully" });
  } catch (error) {
    console.log("RecentlyViewed MERGE error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /recently-viewed/:userId
// Clear entire recently viewed history for a user
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    await RecentlyViewed.findOneAndDelete({ userId });
    res.status(200).json({ message: "Recently viewed history cleared" });
  } catch (error) {
    console.log("RecentlyViewed DELETE error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

module.exports = router;

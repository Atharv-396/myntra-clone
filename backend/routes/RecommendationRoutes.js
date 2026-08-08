/**
 * RecommendationRoutes.js
 * GET /recommendations — personalized "You May Also Like" products.
 *
 * Query params:
 *   userId        (optional) — if provided, returns personalized recommendations
 *   productId     (optional) — exclude current product from results
 *   limit         (optional, default 10, max 20)
 *
 * Authentication: no JWT middleware (consistent with all existing routes in this project).
 * userId is trusted from the client (same pattern as /bag/:userid, /order/user/:userid etc.)
 *
 * Response: { products: [...] }
 * Errors never crash — falls back to popular products.
 */

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const {
  getRecommendations,
  getFallbackRecommendations,
} = require("../services/recommendationService");

// GET /recommendations
router.get("/", async (req, res) => {
  try {
    const { userId, productId, limit = 10 } = req.query;

    // Anonymous user or no userId — return fallback (newest active in-stock products)
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      const products = await getFallbackRecommendations(productId, limit);
      return res.status(200).json({ products });
    }

    // Personalized recommendations
    const products = await getRecommendations(userId, productId, limit);

    // If no personalized results, fall back gracefully
    if (products.length === 0) {
      const fallback = await getFallbackRecommendations(productId, limit);
      return res.status(200).json({ products: fallback });
    }

    return res.status(200).json({ products });
  } catch (error) {
    console.log("GET /recommendations error:", error);
    // Never return 500 — fail gracefully with fallback
    try {
      const { productId, limit = 10 } = req.query;
      const fallback = await getFallbackRecommendations(productId, limit);
      return res.status(200).json({ products: fallback });
    } catch (fallbackError) {
      return res.status(200).json({ products: [] });
    }
  }
});

module.exports = router;

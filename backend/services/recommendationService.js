/**
 * recommendationService.js
 * Generates "You May Also Like" product recommendations.
 *
 * Signals used (reusing existing models — no new collections needed):
 *   - RecentlyViewed   → browsing history (brands/names the user looked at)
 *   - Wishlist         → strong interest signals
 *   - Order            → purchase history (excluded from recs + used for category preference)
 *   - Product          → all products (source for candidates + filtering)
 *   - Category         → maps products to category names
 *
 * Scoring weights (centralized here):
 *   SCORE_SAME_BRAND        = 40  (viewed product's brand matches candidate)
 *   SCORE_SAME_CATEGORY     = 30  (product in same category as viewed/wishlisted)
 *   SCORE_WISHLIST_BRAND    = 25  (matches brand of wishlisted product)
 *   SCORE_WISHLIST_CATEGORY = 20  (matches category of wishlisted product)
 *   SCORE_PURCHASE_CATEGORY = 15  (matches category of purchased product)
 *   SCORE_RECENT_PURCHASE   = 10  (brand of recently purchased — still relevant)
 *   SCORE_NEW_ARRIVAL       =  5  (recently added product — fallback freshness signal)
 *
 * Configuration:
 *   MAX_HISTORY    = 50   (max unique recently viewed products per user)
 *   RECENT_DAYS    = 30   (products purchased within 30 days are excluded)
 *   DEFAULT_LIMIT  = 10
 *   MAX_LIMIT      = 20
 */

const mongoose = require("mongoose");
const Product = require("../models/Product");
const RecentlyViewed = require("../models/RecentlyViewed");
const Wishlist = require("../models/Wishlist");
const Order = require("../models/Order");
const Category = require("../models/Category");

const MAX_HISTORY = 50;
const RECENT_PURCHASE_DAYS = 30;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

// Scoring weights
const SCORE = {
  SAME_BRAND: 40,
  SAME_CATEGORY: 30,
  WISHLIST_BRAND: 25,
  WISHLIST_CATEGORY: 20,
  PURCHASE_CATEGORY: 15,
  RECENT_PURCHASE_BRAND: 10,
  NEW_ARRIVAL: 5,
};

/**
 * Build a frequency map from an array of values.
 * Returns { value: count } sorted by count descending.
 */
function buildFreqMap(values) {
  const map = {};
  for (const v of values) {
    if (v) map[v] = (map[v] || 0) + 1;
  }
  return map;
}

/**
 * Get the top N keys from a frequency map.
 */
function topKeys(freqMap, n = 5) {
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Fetch user activity signals in parallel.
 * Returns browsed products, wishlisted products, purchased product IDs,
 * recently purchased product IDs (for exclusion).
 */
async function fetchUserSignals(userId) {
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - RECENT_PURCHASE_DAYS);

  const [viewHistory, wishlistItems, allOrders] = await Promise.all([
    RecentlyViewed.findOne({ userId })
      .populate("products.productId", "name brand price images active stock")
      .lean(),
    Wishlist.find({ userId })
      .populate("productId", "name brand price images active stock")
      .lean(),
    Order.find({ userId })
      .select("items createdAt")
      .populate("items.productId", "name brand price images active stock")
      .lean(),
  ]);

  // Extract viewed products (newest first, filter nulls/inactive)
  const viewedProducts = (viewHistory?.products || [])
    .filter((p) => p.productId && p.productId.active !== false)
    .reverse() // newest first
    .slice(0, MAX_HISTORY)
    .map((p) => p.productId);

  // Extract wishlisted products (filter nulls/inactive)
  const wishlistedProducts = wishlistItems
    .filter((w) => w.productId && w.productId.active !== false)
    .map((w) => w.productId);

  // All-time purchased product IDs (for exclusion + category signal)
  const allPurchasedIds = new Set(
    allOrders.flatMap((o) => o.items.map((i) => i.productId?._id?.toString()))
      .filter(Boolean)
  );

  // Recently purchased IDs (within RECENT_PURCHASE_DAYS — these are excluded)
  const recentlyPurchasedIds = new Set(
    allOrders
      .filter((o) => new Date(o.createdAt) >= recentCutoff)
      .flatMap((o) => o.items.map((i) => i.productId?._id?.toString()))
      .filter(Boolean)
  );

  // All purchased products (for category signal)
  const purchasedProducts = allOrders
    .flatMap((o) => o.items.map((i) => i.productId))
    .filter((p) => p && p.active !== false);

  return {
    viewedProducts,
    wishlistedProducts,
    recentlyPurchasedIds,
    allPurchasedIds,
    purchasedProducts,
  };
}

/**
 * Fetch all categories once and build a lookup:
 *   productId → categoryName[]
 * This avoids N+1 queries when categorizing products.
 */
async function buildCategoryLookup() {
  const categories = await Category.find().select("name productId").lean();
  const productCategoryMap = {}; // productId → [categoryName, ...]

  for (const cat of categories) {
    for (const pid of cat.productId) {
      const key = pid.toString();
      if (!productCategoryMap[key]) productCategoryMap[key] = [];
      productCategoryMap[key].push(cat.name);
    }
  }
  return productCategoryMap;
}

/**
 * Main recommendation function.
 * Returns up to `limit` scored, filtered products.
 */
async function getRecommendations(userId, currentProductId, limit = DEFAULT_LIMIT) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), MAX_LIMIT);

  // ── Fetch signals ────────────────────────────────────────────────────────
  const {
    viewedProducts,
    wishlistedProducts,
    recentlyPurchasedIds,
    allPurchasedIds,
    purchasedProducts,
  } = await fetchUserSignals(userId);

  const categoryLookup = await buildCategoryLookup();

  // ── Extract preference signals ───────────────────────────────────────────
  // Favorite brands (from viewed + wishlisted, weighted by freq)
  const allInteractedProducts = [...viewedProducts, ...wishlistedProducts];
  const brandFreq = buildFreqMap(allInteractedProducts.map((p) => p.brand));
  const favoriteBrands = new Set(topKeys(brandFreq, 5));

  // Favorite categories (from viewed + wishlisted + purchased)
  const allCategoryProducts = [...allInteractedProducts, ...purchasedProducts];
  const categoryFreq = buildFreqMap(
    allCategoryProducts.flatMap((p) => categoryLookup[p._id?.toString()] || [])
  );
  const favoriteCategories = new Set(topKeys(categoryFreq, 5));

  // Wishlist brands/categories for scoring
  const wishlistBrands = new Set(wishlistedProducts.map((p) => p.brand).filter(Boolean));
  const wishlistCategories = new Set(
    wishlistedProducts.flatMap((p) => categoryLookup[p._id?.toString()] || [])
  );

  // Purchase brands/categories for scoring
  const purchasedBrands = new Set(purchasedProducts.map((p) => p.brand).filter(Boolean));
  const purchasedCategories = new Set(
    purchasedProducts.flatMap((p) => categoryLookup[p._id?.toString()] || [])
  );

  // ── Build exclusion set ──────────────────────────────────────────────────
  const excludeIds = new Set([
    ...(currentProductId ? [currentProductId.toString()] : []),
    ...recentlyPurchasedIds,
  ]);

  // ── Fetch all active, in-stock candidates in ONE query ───────────────────
  const candidates = await Product.find({
    active: { $ne: false },
    $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }],
  })
    .select("_id name brand price discount images stock active createdAt")
    .lean();

  // ── Score candidates ─────────────────────────────────────────────────────
  const scored = [];
  for (const product of candidates) {
    const pid = product._id.toString();

    // Skip excluded
    if (excludeIds.has(pid)) continue;

    const productCategories = categoryLookup[pid] || [];
    let score = 0;

    // Brand signals
    if (favoriteBrands.has(product.brand)) score += SCORE.SAME_BRAND;
    if (wishlistBrands.has(product.brand)) score += SCORE.WISHLIST_BRAND;
    if (purchasedBrands.has(product.brand)) score += SCORE.RECENT_PURCHASE_BRAND;

    // Category signals
    for (const cat of productCategories) {
      if (favoriteCategories.has(cat)) score += SCORE.SAME_CATEGORY;
      if (wishlistCategories.has(cat)) score += SCORE.WISHLIST_CATEGORY;
      if (purchasedCategories.has(cat)) score += SCORE.PURCHASE_CATEGORY;
    }

    // New arrival boost (added in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (product.createdAt && new Date(product.createdAt) >= thirtyDaysAgo) {
      score += SCORE.NEW_ARRIVAL;
    }

    // Only include if has any signal OR no user history (fallback for new users)
    scored.push({ product, score });
  }

  // ── Sort by score descending, shuffle ties for variety ───────────────────
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Shuffle equal-score items for variety
    return Math.random() - 0.5;
  });

  return scored.slice(0, safeLimit).map((s) => s.product);
}

/**
 * Fallback recommendations for anonymous users (no userId).
 * Returns newest active in-stock products.
 */
async function getFallbackRecommendations(currentProductId, limit = DEFAULT_LIMIT) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), MAX_LIMIT);

  const query = {
    active: { $ne: false },
    $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }],
  };
  if (currentProductId && mongoose.Types.ObjectId.isValid(currentProductId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(currentProductId) };
  }

  // Return newest products as fallback (most recently added = "trending" proxy)
  return Product.find(query)
    .select("_id name brand price discount images stock active createdAt")
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

module.exports = { getRecommendations, getFallbackRecommendations, MAX_HISTORY };

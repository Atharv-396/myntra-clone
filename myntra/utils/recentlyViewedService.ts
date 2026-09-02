/**
 * recentlyViewedService.ts
 * Handles all recently viewed API interactions.
 * Reuses BASE_URL from the central config.
 */

import axios from "axios";
import BASE_URL from "@/config/api";
import {
  addToLocalRecentlyViewed,
  clearLocalRecentlyViewed,
  getLocalRecentlyViewed,
} from "./recentlyViewedStorage";

/** Track a product view.
 * - If logged in: send to backend (silent, never blocks UX)
 * - If guest: store locally
 */
export const trackProductView = async (
  productId: string,
  userId?: string | null
): Promise<void> => {
  try {
    if (userId) {
      // Logged in — save to MongoDB (fire and forget)
      axios
        .post(`${BASE_URL}/recently-viewed`, { userId, productId })
        .catch((e) => console.log("Track view error:", e));
    } else {
      // Guest — save locally
      await addToLocalRecentlyViewed(productId);
    }
  } catch (e) {
    console.log("trackProductView error:", e);
  }
};

/** Fetch recently viewed products for a logged-in user from MongoDB */
export const fetchRecentlyViewed = async (userId: string): Promise<any[]> => {
  try {
    const res = await axios.get(`${BASE_URL}/recently-viewed/${userId}`);
    return res.data;
  } catch (e) {
    console.log("fetchRecentlyViewed error:", e);
    return [];
  }
};

/** Fetch continue shopping products (viewed but not purchased) */
export const fetchContinueShopping = async (userId: string): Promise<any[]> => {
  try {
    const res = await axios.get(
      `${BASE_URL}/recently-viewed/${userId}/continue-shopping`
    );
    return res.data;
  } catch (e) {
    console.log("fetchContinueShopping error:", e);
    return [];
  }
};

/** Merge local guest history into MongoDB after login.
 * Called from AuthContext after successful login.
 */
export const mergeLocalHistoryAfterLogin = async (
  userId: string
): Promise<void> => {
  try {
    const localHistory = await getLocalRecentlyViewed();
    if (localHistory.length === 0) return; // nothing to merge

    await axios.post(`${BASE_URL}/recently-viewed/merge`, {
      userId,
      localHistory,
    });

    // Clear local storage after successful merge
    await clearLocalRecentlyViewed();
  } catch (e) {
    console.log("mergeLocalHistoryAfterLogin error:", e);
  }
};

/** Clear all recently viewed history for a user (on logout or user request).
 * Throws on failure so callers can handle the error. */
export const clearRecentlyViewed = async (userId: string): Promise<void> => {
  const res = await axios.delete(`${BASE_URL}/recently-viewed/${userId}`);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to clear recently viewed: server returned ${res.status}`);
  }
};

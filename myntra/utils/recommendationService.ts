/**
 * recommendationService.ts
 * Fetches "You May Also Like" recommendations from the backend.
 * Reuses BASE_URL from config/api.ts — consistent with all other services.
 */

import axios from "axios";
import BASE_URL from "@/config/api";

export interface RecommendedProduct {
  _id: string;
  name: string;
  brand: string;
  price: number;
  discount?: string;
  images: string[];
  stock?: number;
}

/**
 * Fetch personalized recommendations.
 * @param userId       — pass user._id for personalized results, undefined for fallback
 * @param productId    — current product to exclude from results
 * @param limit        — number of products to return (default 10, max 20)
 */
export const fetchRecommendations = async (
  userId: string | undefined,
  productId?: string,
  limit: number = 10
): Promise<RecommendedProduct[]> => {
  try {
    const params: Record<string, string | number> = { limit };
    if (userId) params.userId = userId;
    if (productId) params.productId = productId;

    const res = await axios.get(`${BASE_URL}/recommendations`, { params });
    return res.data?.products || [];
  } catch (e) {
    console.log("fetchRecommendations error:", e);
    return []; // never throw — recommendation failure must not break the UI
  }
};

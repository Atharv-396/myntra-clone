/**
 * YouMayAlsoLikeSection.tsx
 * Horizontal scrollable "You May Also Like" recommendation section.
 *
 * - Personalized when userId is provided (browsing/wishlist/purchase signals)
 * - Falls back to newest active in-stock products for anonymous/new users
 * - Reuses the same card style as RecentlyViewedSection and ContinueShoppingSection
 * - Fails silently — never crashes the parent screen
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  fetchRecommendations,
  RecommendedProduct,
} from "@/utils/recommendationService";

interface YouMayAlsoLikeSectionProps {
  /** Current product ID — excluded from recommendations */
  currentProductId?: string;
  /** Logged-in user ID — enables personalization */
  userId?: string;
  /** Number of recommendations to show (default 10) */
  limit?: number;
}

export default function YouMayAlsoLikeSection({
  currentProductId,
  userId,
  limit = 10,
}: YouMayAlsoLikeSectionProps) {
  const router = useRouter();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchRecommendations(userId, currentProductId, limit);
        if (!cancelled) setProducts(data);
      } catch {
        // fetchRecommendations already handles errors silently
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true; // prevent state update on unmounted component
    };
  }, [userId, currentProductId, limit]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOU MAY ALSO LIKE</Text>
        <ActivityIndicator size="small" color="#ff3f6c" style={styles.loader} />
      </View>
    );
  }

  // Empty state — hide section entirely (same pattern as RecentlyViewedSection)
  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>YOU MAY ALSO LIKE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {products.map((product) => (
          <TouchableOpacity
            key={product._id}
            style={styles.card}
            onPress={() => router.push(`/product/${product._id}`)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: product.images?.[0] }}
              style={styles.image}
            />
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.name} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{product.price}</Text>
              {product.discount ? (
                <Text style={styles.discount}>{product.discount}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// Styles match RecentlyViewedSection and ContinueShoppingSection exactly
const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  scroll: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
  },
  loader: {
    marginVertical: 20,
  },
  card: {
    width: 130,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
    overflow: "hidden",
    paddingBottom: 8,
  },
  image: {
    width: 130,
    height: 155,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  brand: {
    fontSize: 11,
    color: "#888",
    paddingHorizontal: 6,
    marginTop: 6,
  },
  name: {
    fontSize: 12,
    color: "#3e3e3e",
    paddingHorizontal: 6,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    marginTop: 4,
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#3e3e3e",
  },
  discount: {
    fontSize: 11,
    color: "#ff3f6c",
  },
});

/**
 * RecentlyViewedSection.tsx
 * Reusable horizontal scrollable section showing recently viewed products.
 * Used on the Home screen and can be embedded anywhere.
 */

import React, { useCallback, useEffect, useState } from "react";
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
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import {
  fetchRecentlyViewed,
} from "@/utils/recentlyViewedService";
import {
  getLocalRecentlyViewed,
} from "@/utils/recentlyViewedStorage";
import axios from "axios";
import BASE_URL from "@/config/api";

interface RecentlyViewedSectionProps {
  /** Refresh trigger — pass a number that changes to force a refresh */
  refreshKey?: number;
}

export default function RecentlyViewedSection({
  refreshKey = 0,
}: RecentlyViewedSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user) {
        const data = await fetchRecentlyViewed(user._id);
        setItems(data);
      } else {
        const local = await getLocalRecentlyViewed();
        if (local.length === 0) {
          setItems([]);
          return;
        }
        const reversed = [...local].reverse();
        const results = await Promise.allSettled(
          reversed.map((item) =>
            axios.get(`${BASE_URL}/product/${item.productId}`)
          )
        );
        const products = results
          .filter((r) => r.status === "fulfilled")
          .map((r: any) => ({
            product: r.value.data,
            viewedAt: new Date().toISOString(),
          }));
        setItems(products);
      }
    } catch (e) {
      console.log("RecentlyViewedSection load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshKey]);

  // useFocusEffect reloads data every time the parent screen comes into focus
  // This ensures the section updates after user navigates back from product detail
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
        <ActivityIndicator
          size="small"
          color="#ff3f6c"
          style={styles.loader}
        />
      </View>
    );
  }

  if (items.length === 0) {
    return null; // hide section entirely if no history
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {items.map((item, index) => {
          const product = item.product; // structure from API
          if (!product) return null;
          return (
            <TouchableOpacity
              key={product._id || index}
              style={styles.card}
              onPress={() => router.push(`/product/${product._id}`)}
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
              <Text style={styles.price}>₹{product.price}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

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
    width: 120,
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
    width: 120,
    height: 140,
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
  price: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#3e3e3e",
    paddingHorizontal: 6,
    marginTop: 4,
  },
});

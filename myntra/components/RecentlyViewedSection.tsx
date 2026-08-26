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
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchRecentlyViewed } from "@/utils/recentlyViewedService";
import { getLocalRecentlyViewed } from "@/utils/recentlyViewedStorage";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";

interface RecentlyViewedSectionProps {
  refreshKey?: number;
}

export default function RecentlyViewedSection({
  refreshKey = 0,
}: RecentlyViewedSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
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

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>RECENTLY VIEWED</Text>
        <ActivityIndicator
          size="small"
          color={theme.colors.primary}
          style={styles.loader}
        />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>RECENTLY VIEWED</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {items.map((item, index) => {
          const product = item.product;
          if (!product) return null;
          return (
            <TouchableOpacity
              key={product._id || index}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={() => router.push(`/product/${product._id}`)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: product.images?.[0] }}
                style={styles.image}
              />
              <Text style={[styles.brand, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                {product.brand}
              </Text>
              <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{product.price}</Text>
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
    borderRadius: 8,
    overflow: "hidden",
    paddingBottom: 8,
  },
  image: {
    width: 120,
    height: 140,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  brand: {
    fontSize: 11,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  name: {
    fontSize: 12,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: "bold",
    paddingHorizontal: 6,
    marginTop: 4,
  },
});

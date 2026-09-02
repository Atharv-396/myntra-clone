import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Trash2, ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  fetchRecentlyViewed,
  clearRecentlyViewed,
} from "@/utils/recentlyViewedService";
import {
  getLocalRecentlyViewed,
  clearLocalRecentlyViewed,
} from "@/utils/recentlyViewedStorage";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

export default function RecentlyViewedScreen() {
  const { user, isHydrated } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { headerPaddingTop, productGridColumns, width } = useResponsive();
  const [items, setItems] = useState<any[]>([]);
  // Start in loading state; flip to false once hydrated+loaded or when no items found
  const [isLoading, setIsLoading] = useState(true);

  // Once hydrated, kick off the first load
  useEffect(() => {
    if (isHydrated) {
      loadHistory();
    }
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async () => {
    // Wait for client-side hydration before reading auth state or localStorage
    if (!isHydrated) return;
    setIsLoading(true);
    try {
      if (user) {
        const data = await fetchRecentlyViewed(user._id);
        setItems(data);
      } else {
        const local = await getLocalRecentlyViewed();
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
      console.log("RecentlyViewed screen load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, isHydrated]);

  const handleClearAll = () => {
    // setTimeout(0) ensures the button loses focus before the Alert opens,
    // preventing the aria-hidden warning on web ("Blocked aria-hidden on focused element")
    setTimeout(() => {
      Alert.alert(
        "Clear History",
        "Are you sure you want to clear your recently viewed history?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: async () => {
              if (user) {
                await clearRecentlyViewed(user._id);
              } else {
                await clearLocalRecentlyViewed();
              }
              setItems([]);
            },
          },
        ]
      );
    }, 0);
  };

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={theme.colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Recently Viewed</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Trash2 size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No recently viewed products</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Products you view will appear here
          </Text>
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/")}
            activeOpacity={0.8}
          >
            <Text style={[styles.shopButtonText, { color: theme.colors.primaryText }]}>START SHOPPING</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {(() => {
            const cardGap = 12;
            const gridPadding = 24;
            const cardWidth = Math.floor((width - gridPadding - (productGridColumns - 1) * cardGap) / productGridColumns);
            const cardImageHeight = Math.round(cardWidth * 1.25);
            return (
              <View style={styles.grid}>
                {items.map((item, index) => {
                  const product = item.product;
                  if (!product) return null;
                  return (
                    <TouchableOpacity
                      key={product._id || index}
                      style={[
                        styles.productCard,
                        {
                          width: cardWidth,
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
                        style={[styles.productImage, { height: cardImageHeight }]}
                      />
                      <View style={styles.productInfo}>
                        <Text style={[styles.brandName, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                          {product.brand}
                        </Text>
                        <Text style={[styles.productName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <View style={styles.priceRow}>
                          <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{product.price}</Text>
                          {product.discount ? (
                            <Text style={[styles.discount, { color: theme.colors.primary }]}>{product.discount}</Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 10, padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
  },
  clearBtn: { padding: 5 },
  content: { flex: 1, padding: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  productCard: {
    borderRadius: 10,
    overflow: "hidden",
  },
  productImage: { width: "100%" },
  productInfo: { padding: 10 },
  brandName: { fontSize: 11, marginBottom: 2 },
  productName: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  price: {
    fontSize: 14,
    fontWeight: "bold",
  },
  discount: { fontSize: 12, fontWeight: "600" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtitle: { fontSize: 14, marginBottom: 24 },
  shopButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: { fontWeight: "bold", fontSize: 14 },
});

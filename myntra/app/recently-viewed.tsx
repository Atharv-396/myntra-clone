import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Trash2, ChevronLeft, AlertCircle, X } from "lucide-react-native";
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
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!isHydrated) return;
    setIsLoading(true);
    setErrorMsg(null);
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

  useEffect(() => {
    if (isHydrated) {
      loadHistory();
    }
  }, [isHydrated, loadHistory]);

  // ── Inline confirm flow — no Alert.alert, works reliably on all platforms ──

  const handleClearPress = () => {
    setShowConfirm(true);
    setErrorMsg(null);
  };

  const handleCancelClear = () => {
    setShowConfirm(false);
  };

  const handleConfirmClear = async () => {
    setShowConfirm(false);
    setIsClearing(true);
    setErrorMsg(null);
    try {
      if (user) {
        // Call backend — rethrow on HTTP error so catch block fires
        const res = await axios.delete(
          `${BASE_URL}/recently-viewed/${user._id}`
        );
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`Server returned ${res.status}`);
        }
      } else {
        await clearLocalRecentlyViewed();
      }
      setItems([]);
    } catch (e: any) {
      console.log("clearRecentlyViewed error:", e?.response?.data, e?.message);
      setErrorMsg("Could not clear history. Tap to retry.");
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Recently Viewed</Text>
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const cardGap = 12;
  const gridPadding = 24;
  const cardWidth = Math.floor(
    (width - gridPadding - (productGridColumns - 1) * cardGap) / productGridColumns
  );
  const cardImageHeight = Math.round(cardWidth * 1.25);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={theme.colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Recently Viewed {items.length > 0 ? `(${items.length})` : ""}
        </Text>
        {items.length > 0 && !isClearing && (
          <TouchableOpacity
            onPress={handleClearPress}
            style={styles.clearBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          >
            <Trash2 size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        {isClearing && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.clearBtn} />
        )}
      </View>

      {/* ── Inline confirm banner ── */}
      {showConfirm && (
        <View style={[styles.confirmBanner, { backgroundColor: theme.isDark ? "#2A1D24" : "#FFF0F3", borderColor: theme.colors.primary }]}>
          <AlertCircle size={18} color={theme.colors.primary} />
          <Text style={[styles.confirmText, { color: theme.colors.textPrimary }]}>
            Clear all recently viewed?
          </Text>
          <TouchableOpacity
            onPress={handleConfirmClear}
            style={[styles.confirmYes, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.confirmYesText, { color: theme.colors.primaryText }]}>Yes, Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancelClear} style={styles.confirmNo} activeOpacity={0.7}>
            <X size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Error banner ── */}
      {errorMsg && (
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: theme.isDark ? "#3A1B1F" : "#FFEEF0" }]}
          onPress={handleConfirmClear}
          activeOpacity={0.8}
        >
          <AlertCircle size={16} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMsg}</Text>
        </TouchableOpacity>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            No recently viewed products
          </Text>
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
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
                    resizeMode="cover"
                  />
                  <View style={styles.productInfo}>
                    <Text style={[styles.brandName, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                      {product.brand}
                    </Text>
                    <Text style={[styles.productName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.price, { color: theme.colors.textPrimary }]}>
                        {"\u20B9"}{product.price}
                      </Text>
                      {product.discount ? (
                        <Text style={[styles.discount, { color: theme.colors.primary }]}>
                          {product.discount}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
  clearBtn: { padding: 8 },
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  confirmYes: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  confirmYesText: {
    fontSize: 13,
    fontWeight: "700",
  },
  confirmNo: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  content: { flex: 1 },
  scrollContent: { padding: 12 },
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
  price: { fontSize: 14, fontWeight: "bold" },
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

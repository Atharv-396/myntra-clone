/**
 * recently-viewed.tsx
 * Full-screen recently viewed history page.
 * Accessible from Profile or any deep link.
 */

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
import { Trash2 } from "lucide-react-native";
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

export default function RecentlyViewedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClearAll = () => {
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
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recently Viewed</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Trash2 size={20} color="#ff3f6c" />
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No recently viewed products</Text>
          <Text style={styles.emptySubtitle}>
            Products you view will appear here
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/")}
          >
            <Text style={styles.shopButtonText}>START SHOPPING</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.grid}>
            {items.map((item, index) => {
              const product = item.product;
              if (!product) return null;
              return (
                <TouchableOpacity
                  key={product._id || index}
                  style={styles.productCard}
                  onPress={() => router.push(`/product/${product._id}`)}
                >
                  <Image
                    source={{ uri: product.images?.[0] }}
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.brandName} numberOfLines={1}>
                      {product.brand}
                    </Text>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₹{product.price}</Text>
                      {product.discount ? (
                        <Text style={styles.discount}>{product.discount}</Text>
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
  container: { flex: 1, backgroundColor: "#fff" },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    paddingTop: 50,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: { paddingRight: 15 },
  backText: { fontSize: 22, color: "#3e3e3e" },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#3e3e3e",
  },
  clearBtn: { padding: 5 },
  content: { flex: 1, padding: 10 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  productImage: { width: "100%", height: 180 },
  productInfo: { padding: 10 },
  brandName: { fontSize: 12, color: "#888", marginBottom: 3 },
  productName: { fontSize: 14, color: "#3e3e3e", marginBottom: 6 },
  priceRow: { flexDirection: "row", alignItems: "center" },
  price: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginRight: 6,
  },
  discount: { fontSize: 12, color: "#ff3f6c" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginBottom: 8,
  },
  emptySubtitle: { fontSize: 14, color: "#888", marginBottom: 24 },
  shopButton: {
    backgroundColor: "#ff3f6c",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});

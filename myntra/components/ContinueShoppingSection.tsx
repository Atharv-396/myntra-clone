/**
 * ContinueShoppingSection.tsx
 * Shows products the user viewed but hasn't purchased yet.
 * Reuses existing add-to-bag and add-to-wishlist logic.
 * Only shown to logged-in users.
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
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ShoppingBag, Heart } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { fetchContinueShopping } from "@/utils/recentlyViewedService";
import axios from "axios";
import BASE_URL from "@/config/api";

interface ContinueShoppingSectionProps {
  refreshKey?: number;
}

export default function ContinueShoppingSection({
  refreshKey = 0,
}: ContinueShoppingSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingToBag, setAddingToBag] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await fetchContinueShopping(user._id);
      setItems(data);
    } catch (e) {
      console.log("ContinueShopping load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshKey]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Also reload on screen focus so data is fresh after navigating back
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleAddToBag = async (productId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      setAddingToBag(productId);
      // Reuse existing bag API — default to first size (user can change in product detail)
      await axios.post(`${BASE_URL}/bag`, {
        userId: user._id,
        productId,
        size: "M", // default size — user can update in bag/product detail
        quantity: 1,
      });
      Alert.alert("Added to bag!");
    } catch (e) {
      console.log("Add to bag error:", e);
    } finally {
      setAddingToBag(null);
    }
  };

  const handleAddToWishlist = async (productId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      // Reuse existing wishlist API
      await axios.post(`${BASE_URL}/wishlist`, {
        userId: user._id,
        productId,
      });
      Alert.alert("Added to wishlist!");
    } catch (e) {
      console.log("Add to wishlist error:", e);
    }
  };

  // Only show for logged-in users
  if (!user) return null;

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTINUE SHOPPING</Text>
        <ActivityIndicator size="small" color="#ff3f6c" style={styles.loader} />
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CONTINUE SHOPPING</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {items.map((item, index) => {
          const product = item.product;
          if (!product) return null;
          return (
            <View key={product._id || index} style={styles.card}>
              <TouchableOpacity
                onPress={() => router.push(`/product/${product._id}`)}
              >
                <Image
                  source={{ uri: product.images?.[0] }}
                  style={styles.image}
                />
                <View style={styles.info}>
                  <Text style={styles.brand} numberOfLines={1}>
                    {product.brand}
                  </Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.price}>₹{product.price}</Text>
                  {product.discount ? (
                    <Text style={styles.discount}>{product.discount}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              {/* Action buttons — reuse existing bag/wishlist logic */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.bagButton}
                  onPress={() => handleAddToBag(product._id)}
                  disabled={addingToBag === product._id}
                >
                  {addingToBag === product._id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <ShoppingBag size={14} color="#fff" />
                      <Text style={styles.bagButtonText}>Add to Bag</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.wishlistButton}
                  onPress={() => handleAddToWishlist(product._id)}
                >
                  <Heart size={16} color="#ff3f6c" />
                </TouchableOpacity>
              </View>
            </View>
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
    width: 150,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
    overflow: "hidden",
  },
  image: {
    width: 150,
    height: 170,
  },
  info: {
    padding: 8,
  },
  brand: {
    fontSize: 11,
    color: "#888",
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    color: "#3e3e3e",
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#3e3e3e",
  },
  discount: {
    fontSize: 11,
    color: "#ff3f6c",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 8,
  },
  bagButton: {
    flex: 1,
    backgroundColor: "#ff3f6c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  bagButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  wishlistButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ff3f6c",
    justifyContent: "center",
    alignItems: "center",
  },
});

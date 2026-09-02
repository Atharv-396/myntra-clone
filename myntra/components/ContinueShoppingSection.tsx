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
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

interface ContinueShoppingSectionProps {
  refreshKey?: number;
}

export default function ContinueShoppingSection({
  refreshKey = 0,
}: ContinueShoppingSectionProps) {
  const { user, isHydrated } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { carouselCardWidth, carouselImageHeight } = useResponsive();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingToBag, setAddingToBag] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!isHydrated || !user) return;
    setIsLoading(true);
    try {
      const data = await fetchContinueShopping(user._id);
      setItems(data);
    } catch (e) {
      console.log("ContinueShopping load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, isHydrated, refreshKey]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleAddToBag = async (product: any) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const productId = product._id || product;
    const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "M";
    try {
      setAddingToBag(productId);
      await axios.post(`${BASE_URL}/bag`, {
        userId: user._id,
        productId,
        size,
        quantity: 1,
      });
      Alert.alert("Success", "Added to bag!");
    } catch (e: any) {
      console.log("Add to bag error:", e);
      Alert.alert("Error", e?.response?.data?.message || "Could not add to bag");
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
      await axios.post(`${BASE_URL}/wishlist`, {
        userId: user._id,
        productId,
      });
      Alert.alert("Added to wishlist!");
    } catch (e) {
      console.log("Add to wishlist error:", e);
    }
  };

  // Don't render until hydrated — avoids SSR/client mismatch (#418)
  if (!isHydrated || !user) return null;

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>CONTINUE SHOPPING</Text>
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>CONTINUE SHOPPING</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {items.map((item, index) => {
          const product = item.product;
          if (!product) return null;
          return (
            <View
              key={product._id || index}
              style={[
                styles.card,
                {
                  width: carouselCardWidth,
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.push(`/product/${product._id}`)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: product.images?.[0] }}
                  style={[styles.image, { width: carouselCardWidth, height: carouselImageHeight }]}
                />
                <View style={styles.info}>
                  <Text style={[styles.brand, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                    {product.brand}
                  </Text>
                  <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{product.price}</Text>
                  {product.discount ? (
                    <Text style={[styles.discount, { color: theme.colors.primary }]}>{product.discount}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.bagButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleAddToBag(product)}
                  disabled={addingToBag === product._id}
                  activeOpacity={0.8}
                >
                  {addingToBag === product._id ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryText} />
                  ) : (
                    <>
                      <ShoppingBag size={14} color={theme.colors.primaryText} />
                      <Text style={[styles.bagButtonText, { color: theme.colors.primaryText }]}>Add to Bag</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.wishlistButton, { borderColor: theme.colors.primary }]}
                  onPress={() => handleAddToWishlist(product._id)}
                  activeOpacity={0.7}
                >
                  <Heart size={16} color={theme.colors.primary} />
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
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
  },
  info: {
    padding: 8,
  },
  brand: {
    fontSize: 11,
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 11,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  bagButtonText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  wishlistButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

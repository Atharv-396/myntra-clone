import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart, ShoppingBag, ChevronLeft } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { trackProductView } from "@/utils/recentlyViewedService";
import { addToCart } from "@/utils/cartService";
import { addToGuestCart } from "@/utils/guestCartStorage";
import YouMayAlsoLikeSection from "@/components/YouMayAlsoLikeSection";
import { useTheme } from "@/theme";

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [selectedSize, setSelectedSize] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const [product, setproduct] = useState<any>(null);
  const [iswishlist, setiswishlist] = useState(false);

  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const res = await axios.get(`${BASE_URL}/product/${id}`);
        setproduct(res.data);
        if (res.data?.sizes && res.data.sizes.length > 0) {
          setSelectedSize(res.data.sizes[0]);
        }
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, [id]);

  useEffect(() => {
    if (id) {
      trackProductView(id as string, user?._id).catch(() => {});
    }
  }, [id, user]);

  const handleAddwishlist = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      await axios.post(`${BASE_URL}/wishlist`, {
        userId: user._id,
        productId: id,
      });
      setiswishlist(true);
      Alert.alert("Added to wishlist!");
    } catch (error) {
      console.log(error);
    }
  };

  const handleAddToBag = async () => {
    const sizeToUse = selectedSize || (product?.sizes && product.sizes.length > 0 ? product.sizes[0] : "M");
    setLoading(true);
    try {
      if (user) {
        await addToCart(user._id, product._id, sizeToUse, product.color || "Default", 1);
      } else {
        await addToGuestCart({
          productId: product._id,
          name: product.name,
          brand: product.brand,
          priceAtAdd: product.price,
          size: sizeToUse,
          color: product.color || "Default",
          image: product.images?.[0] || "",
          quantity: 1,
        });
      }
      Alert.alert("Success", "Added to bag!");
    } catch (error: any) {
      console.log("Add to bag error:", error);
      Alert.alert("Error", error?.response?.data?.message || "Failed to add to bag");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const imageIndex = Math.round(contentOffset.x / width);
    setCurrentImageIndex(imageIndex);
  };

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 60 }}>
          Product not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Nav Back Button */}
      <View style={[styles.navHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={theme.colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {product.brand}
        </Text>
        <TouchableOpacity onPress={handleAddwishlist} style={styles.wishlistNavBtn} activeOpacity={0.7}>
          <Heart
            size={22}
            color={iswishlist ? theme.colors.primary : theme.colors.icon}
            fill={iswishlist ? theme.colors.primary : "none"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {product.images?.map((image: any, index: any) => (
              <Image
                key={index}
                source={{ uri: image }}
                style={[styles.productImage, { width }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {product.images?.map((_: any, index: any) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  currentImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.content, { backgroundColor: theme.colors.card }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.brand, { color: theme.colors.textTertiary }]}>{product.brand}</Text>
              <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{product.name}</Text>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{product.price}</Text>
            {product.discount ? (
              <Text style={[styles.discount, { color: theme.colors.primary }]}>{product.discount}</Text>
            ) : null}
          </View>

          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{product.description}</Text>

          <View style={styles.sizeSection}>
            <Text style={[styles.sizeTitle, { color: theme.colors.textPrimary }]}>Select Size</Text>
            <View style={styles.sizeGrid}>
              {product.sizes?.map((size: any) => {
                const isSelected = selectedSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeButton,
                      {
                        backgroundColor: isSelected ? (theme.isDark ? "#3A1B24" : "#FFF4F4") : theme.colors.surfaceSecondary,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setSelectedSize(size)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sizeText,
                        { color: isSelected ? theme.colors.primary : theme.colors.textPrimary },
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* You May Also Like */}
        <YouMayAlsoLikeSection
          currentProductId={id as string}
          userId={user?._id}
          limit={10}
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.divider }]}>
        <TouchableOpacity
          style={[styles.addToBagButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleAddToBag}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primaryText} />
          ) : (
            <>
              <ShoppingBag size={20} color={theme.colors.primaryText} />
              <Text style={[styles.addToBagText, { color: theme.colors.primaryText }]}>ADD TO BAG</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "bold",
  },
  wishlistNavBtn: {
    padding: 6,
  },
  carouselContainer: {
    position: "relative",
  },
  productImage: {
    height: 380,
  },
  pagination: {
    position: "absolute",
    bottom: 16,
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#fff",
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  content: {
    padding: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 14,
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 14,
    fontWeight: "bold",
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  sizeSection: {
    marginBottom: 10,
  },
  sizeTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sizeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  addToBagButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  addToBagText: {
    fontSize: 15,
    fontWeight: "bold",
  },
});

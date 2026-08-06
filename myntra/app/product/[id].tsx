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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Heart, ShoppingBag } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { trackProductView } from "@/utils/recentlyViewedService";

// Mock product data - in a real app, this would come from an API
// const products = {
//   "1": {
//     id: 1,
//     name: "Casual White T-Shirt",
//     brand: "Roadster",
//     price: 499,
//     discount: "60% OFF",
//     description:
//       "Classic white t-shirt made from premium cotton. Perfect for everyday wear with a comfortable regular fit.",
//     sizes: ["S", "M", "L", "XL"],
//     images: [
//       "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop",
//     ],
//   },
//   "2": {
//     id: 2,
//     name: "Denim Jacket",
//     brand: "Levis",
//     price: 2499,
//     discount: "40% OFF",
//     description:
//       "Classic denim jacket with a modern twist. Features premium quality denim and comfortable fit.",
//     sizes: ["S", "M", "L", "XL"],
//     images: [
//       "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1601933973783-43cf8a7d4c5f?w=500&auto=format&fit=crop",
//     ],
//   },
//   "3": {
//     id: 3,
//     name: "Summer Dress",
//     brand: "ONLY",
//     price: 1299,
//     discount: "50% OFF",
//     description:
//       "Flowy summer dress perfect for warm weather. Made from lightweight fabric with a flattering cut.",
//     sizes: ["XS", "S", "M", "L"],
//     images: [
//       "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop",
//     ],
//   },
//   "4": {
//     id: 4,
//     name: "Classic Sneakers",
//     brand: "Nike",
//     price: 3499,
//     discount: "30% OFF",
//     description:
//       "Versatile sneakers that combine style and comfort. Perfect for both casual wear and light exercise.",
//     sizes: ["UK6", "UK7", "UK8", "UK9", "UK10"],
//     images: [
//       "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&auto=format&fit=crop",
//       "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop",
//     ],
//   },
// };

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedSize, setSelectedSize] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const [product, setproduct] = useState<any>(null);
  const [iswishlist, setiswishlist] = useState(false);
  useEffect(() => {
    // Simulate loading time

    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const product = await axios.get(`${BASE_URL}/product/${id}`);
        setproduct(product.data);

        // Track this product view ONLY after successfully loading the detail page
        trackProductView(id as string, user?._id ?? null);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, []);

  useEffect(() => {
    // Start auto-scroll
    startAutoScroll();

    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, []);

  const startAutoScroll = () => {
    autoScrollTimer.current = setInterval(() => {
      if (product && scrollViewRef.current) {
        const nextIndex = (currentImageIndex + 1) % product.images.length;
        scrollViewRef.current.scrollTo({
          x: nextIndex * width,
          animated: true,
        });
        setCurrentImageIndex(nextIndex);
      }
    }, 3000);
  };

  if (!product) {
    return (
      <View style={styles.container}>
        <Text>Product not found</Text>
      </View>
    );
  }
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
      router.push("/wishlist");
    } catch (error) {
      console.log(error);
    }
  };
  const handleAddToBag = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedSize) {
      // In a real app, show a proper error message
      alert("Please select a size");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${BASE_URL}/bag`, {
        userId: user._id,
        productId: id,
        size: selectedSize,
        quantity: 1,
      });
      router.push("/bag");
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
    // In a real app, this would add the item to the cart in your state management solution
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const imageIndex = Math.round(contentOffset.x / width);
    setCurrentImageIndex(imageIndex);

    // Reset auto-scroll timer when user manually scrolls
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      startAutoScroll();
    }
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
            {product.images.map((image: any, index: any) => (
              <Image
                key={index}
                source={{ uri: image }}
                style={[styles.productImage, { width }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {product.images.map((_: any, index: any) => (
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

        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>{product.brand}</Text>
              <Text style={styles.name}>{product.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.wishlistButton}
              onPress={handleAddwishlist}
            >
              <Heart
                size={24}
                color={iswishlist ? "#ff3f6c" : "#ccc"}
                fill={iswishlist ? "#ff3f6c" : "none"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{product.price}</Text>
            <Text style={styles.discount}>{product.discount}</Text>
          </View>

          <Text style={styles.description}>{product.description}</Text>

          <View style={styles.sizeSection}>
            <Text style={styles.sizeTitle}>Select Size</Text>
            <View style={styles.sizeGrid}>
              {product.sizes.map((size: any) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeButton,
                    selectedSize === size && styles.selectedSize,
                  ]}
                  onPress={() => setSelectedSize(size)}
                >
                  <Text
                    style={[
                      styles.sizeText,
                      selectedSize === size && styles.selectedSizeText,
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addToBagButton}
          onPress={handleAddToBag}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ff3f6c" />
          ) : (
            <>
              <ShoppingBag size={20} color="#fff" />
              <Text style={styles.addToBagText}>ADD TO BAG</Text>
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
    backgroundColor: "#fff",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  carouselContainer: {
    position: "relative",
  },
  productImage: {
    height: 400,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: "#fff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginBottom: 10,
  },
  wishlistButton: {
    padding: 10,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  price: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginRight: 10,
  },
  discount: {
    fontSize: 16,
    color: "#ff3f6c",
  },
  description: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 20,
  },
  sizeSection: {
    marginBottom: 20,
  },
  sizeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3e3e3e",
    marginBottom: 10,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedSize: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff4f4",
  },
  sizeText: {
    fontSize: 16,
    color: "#3e3e3e",
  },
  selectedSizeText: {
    color: "#ff3f6c",
  },
  footer: {
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  addToBagButton: {
    backgroundColor: "#ff3f6c",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  addToBagText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

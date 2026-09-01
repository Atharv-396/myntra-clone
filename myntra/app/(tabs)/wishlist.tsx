import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useRouter } from "expo-router";
import { Heart, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

export default function Wishlist() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { headerPaddingTop, isTablet } = useResponsive();
  const [wishlist, setwishlist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchproduct();
  }, [user]);

  const fetchproduct = async () => {
    if (user) {
      try {
        setIsLoading(true);
        const bag = await axios.get(`${BASE_URL}/wishlist/${user._id}`);
        setwishlist(bag.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handledelete = async (itemid: any) => {
    try {
      await axios.delete(`${BASE_URL}/wishlist/${itemid}`);
      fetchproduct();
    } catch (error) {
      console.log(error);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Wishlist</Text>
        </View>
        <View style={styles.emptyState}>
          <Heart size={64} color={theme.colors.primary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
            Please login to view your wishlist
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // On tablet, item image is larger
  const itemImageWidth = isTablet ? 130 : 100;
  const itemImageHeight = isTablet ? 160 : 120;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Wishlist</Text>
      </View>

      <ScrollView style={styles.content}>
        {wishlist?.length === 0 ? (
          <View style={styles.emptyState}>
            <Heart size={56} color={theme.colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>Your wishlist is empty</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>Explore items and tap the heart icon to save them</Text>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push("/")}
              activeOpacity={0.8}
            >
              <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>DISCOVER NOW</Text>
            </TouchableOpacity>
          </View>
        ) : (
          wishlist?.map((item: any) => (
            <View
              key={item._id}
              style={[
                styles.wishlistItem,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => item.productId?._id && router.push(`/product/${item.productId._id}`)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.productId?.images?.[0] }} style={[styles.itemImage, { width: itemImageWidth, height: itemImageHeight }]} />
              </TouchableOpacity>
              <View style={styles.itemInfo}>
                <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{item.productId?.brand}</Text>
                <Text style={[styles.itemName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                  {item.productId?.name}
                </Text>
                <View style={styles.priceContainer}>
                  <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{item.productId?.price}</Text>
                  {item.productId?.discount && (
                    <Text style={[styles.discount, { color: theme.colors.primary }]}>{item.productId?.discount}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handledelete(item._id)}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  loginButton: {
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  wishlistItem: {
    flexDirection: "row",
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
  },
  itemImage: {
    // width/height set dynamically
  },
  itemInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  brandName: {
    fontSize: 12,
    marginBottom: 3,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});

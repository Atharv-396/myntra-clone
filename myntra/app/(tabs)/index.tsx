import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, ChevronRight } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
import ContinueShoppingSection from "@/components/ContinueShoppingSection";
import YouMayAlsoLikeSection from "@/components/YouMayAlsoLikeSection";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

const deals = [
  {
    id: 1,
    title: "Under ₹599",
    image:
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "40-70% Off",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop",
  },
];

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const { headerPaddingTop, bannerHeight, productGridColumns, width, isTablet, isDesktop } = useResponsive();
  const [isLoading, setIsLoading] = useState(false);
  const [product, setproduct] = useState<any>(null);
  const [categories, setcategories] = useState<any>(null);
  const { user } = useAuth();

  const cardWidth = Math.floor((width - 32 - (productGridColumns - 1) * 8) / productGridColumns);
  const cardImageHeight = Math.round(cardWidth * 1.25);
  // Deal card scales: wider on tablet/desktop, standard on phone
  const dealCardWidth = isDesktop ? 380 : isTablet ? 320 : Math.min(260, width * 0.72);
  const dealCardHeight = Math.round(dealCardWidth * 0.54);

  const handleProductPress = (productId: number) => {
    router.push(`/product/${productId}`);
  };

  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const cat = await axios.get(`${BASE_URL}/category`);
        const product = await axios.get(`${BASE_URL}/product`);
        setcategories(cat.data);
        setproduct(product.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <Text style={[styles.logo, { color: theme.colors.textPrimary }]}>MYNTRA</Text>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: theme.colors.surfaceSecondary }]}
          onPress={() => router.push("/categories")}
          activeOpacity={0.7}
        >
          <Search size={20} color={theme.colors.icon} />
        </TouchableOpacity>
      </View>

      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop",
        }}
        style={[styles.banner, { height: bannerHeight }]}
        resizeMode="cover"
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>SHOP BY CATEGORY</Text>
          <TouchableOpacity
            style={styles.viewAll}
            onPress={() => router.push("/categories")}
          >
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
            <ChevronRight size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : !categories || categories.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No categories available</Text>
          ) : (
            categories.map((category: any) => (
              <TouchableOpacity
                key={category._id}
                style={styles.categoryCard}
                onPress={() => router.push("/categories")}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: category.image }}
                  style={[styles.categoryImage, { borderColor: theme.colors.border }]}
                />
                <Text style={[styles.categoryName, { color: theme.colors.textPrimary }]}>{category.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>DEALS OF THE DAY</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dealsScroll}
        >
          {deals.map((deal) => (
            <TouchableOpacity key={deal.id} style={[styles.dealCard, { width: dealCardWidth, height: dealCardHeight }]} activeOpacity={0.85}>
              <Image source={{ uri: deal.image }} style={styles.dealImage} />
              <View style={styles.dealOverlay}>
                <Text style={styles.dealTitle}>{deal.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recently Viewed */}
      <RecentlyViewedSection />

      {/* Continue Shopping */}
      <ContinueShoppingSection />

      {/* You May Also Like */}
      <YouMayAlsoLikeSection userId={user?._id} limit={10} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>TRENDING NOW</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={styles.loader}
          />
        ) : !product || product.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No Product available</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.trendingScroll}
            contentContainerStyle={styles.trendingContent}
          >
            {product.map((p: any) => (
              <TouchableOpacity
                key={p._id}
                style={[
                  styles.trendingCard,
                  {
                    width: cardWidth,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleProductPress(p._id)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: p.images?.[0] }}
                  style={[styles.productImage, { height: cardImageHeight }]}
                  resizeMode="cover"
                />
                <View style={styles.productInfo}>
                  <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{p.brand}</Text>
                  <Text style={[styles.productName, { color: theme.colors.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.productPrice, { color: theme.colors.textPrimary }]}>₹{p.price}</Text>
                    {p.discount ? (
                      <Text style={[styles.discount, { color: theme.colors.primary }]}>{p.discount}</Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  logo: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  searchButton: {
    padding: 8,
    borderRadius: 20,
  },
  banner: {
    width: "100%",
    resizeMode: "cover",
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 4,
  },
  categoriesScroll: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
  },
  categoryCard: {
    width: 90,
    marginRight: 12,
    alignItems: "center",
  },
  categoryImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
  },
  categoryName: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
  },
  dealsScroll: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
  },
  dealCard: {
    marginRight: 12,
    borderRadius: 10,
    overflow: "hidden",
  },
  dealImage: {
    width: "100%",
    height: "100%",
  },
  dealOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
  },
  dealTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  productsGrid: {
    // kept for any future grid use
  },
  trendingScroll: {
    marginHorizontal: -15,
    paddingHorizontal: 15,
  },
  trendingContent: {
    paddingRight: 15,
    gap: 10,
  },
  trendingCard: {
    borderRadius: 10,
    overflow: "hidden",
  },
  productCard: {
    marginBottom: 12,
    borderRadius: 10,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
  },
  productInfo: {
    padding: 10,
  },
  brandName: {
    fontSize: 12,
    marginBottom: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 12,
    fontWeight: "600",
  },
  loader: {
    marginTop: 40,
  },
});

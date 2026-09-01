import {
  StyleSheet,
  Image,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

export default function CategoriesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { headerPaddingTop, productGridColumns, width, isTablet, isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setcategories] = useState<any>(null);

  useEffect(() => {
    const fetchproduct = async () => {
      try {
        setIsLoading(true);
        const cat = await axios.get(`${BASE_URL}/category`);
        setcategories(cat.data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };
    fetchproduct();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!categories) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 40 }}>
          Categories not found
        </Text>
      </View>
    );
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory(null);
    setSearchQuery("");
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
    setSearchQuery("");
  };

  const filtercategories = categories?.filter(
    (category: any) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.subcategory?.some((subcategory: any) =>
        subcategory.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      category.productId?.some(
        (product: any) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const selectedcategorydata = selectedCategory
    ? categories?.find((cat: any) => cat._id === selectedCategory)
    : null;

  // Dynamic product card width based on screen size
  const cardGap = 12;
  const gridPadding = 24; // 12 on each side
  const cardWidth = Math.floor((width - gridPadding - (productGridColumns - 1) * cardGap) / productGridColumns);
  const cardImageHeight = Math.round(cardWidth * 1.2);
  // Category card image height scales with screen
  const categoryImageHeight = isDesktop ? 200 : isTablet ? 180 : 140;

  const renderProducts = (products: any) => {
    return products?.map((product: any) => (
      <TouchableOpacity
        key={product._id}
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
        <Image source={{ uri: product.images?.[0] }} style={[styles.productImage, { height: cardImageHeight }]} />
        <View style={styles.productInfo}>
          <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{product.brand}</Text>
          <Text style={[styles.productName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
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
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Categories</Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Search size={18} color={theme.colors.iconSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search for products, brands and more"
            placeholderTextColor={theme.colors.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={clearSearch} style={{ padding: 4 }}>
              <X size={18} color={theme.colors.iconSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {!selectedCategory && (
          <View style={styles.categoriesGrid}>
            {filtercategories?.map((category: any) => (
              <TouchableOpacity
                key={category._id}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleCategorySelect(category._id)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: category.image }}
                  style={[styles.categoryImage, { height: categoryImageHeight }]}
                />
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: theme.colors.textPrimary }]}>{category.name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.subcategories}>
                      {category?.subcategory?.map((sub: any, index: any) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.subcategoryTag, { backgroundColor: theme.colors.surfaceSecondary }]}
                          onPress={() => handleSubcategorySelect(sub)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.subcategoryText, { color: theme.colors.textSecondary }]}>{sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedcategorydata && (
          <View style={styles.categoryDetail}>
            <View style={styles.categoryHeader}>
              <TouchableOpacity
                style={[styles.backButton, { borderColor: theme.colors.primary }]}
                onPress={() => setSelectedCategory(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>← Back to Categories</Text>
              </TouchableOpacity>
              <Text style={[styles.categoryTitle, { color: theme.colors.textPrimary }]}>
                {selectedcategorydata.name}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.subcategoriesScroll}
            >
              {selectedcategorydata.subcategory?.map((sub: any, index: any) => {
                const isSelected = selectedSubcategory === sub;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.subcategoryButton,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => handleSubcategorySelect(sub)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subcategoryButtonText,
                        { color: isSelected ? theme.colors.primaryText : theme.colors.textSecondary },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.productsGrid}>
              {renderProducts(selectedcategorydata?.productId)}
            </View>
          </View>
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
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  categoriesGrid: {
    padding: 12,
    gap: 12,
  },
  categoryCard: {
    borderRadius: 10,
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
  },
  categoryInfo: {
    padding: 12,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subcategories: {
    flexDirection: "row",
    gap: 8,
  },
  subcategoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subcategoryText: {
    fontSize: 12,
    fontWeight: "500",
  },
  categoryDetail: {
    padding: 12,
  },
  categoryHeader: {
    marginBottom: 12,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subcategoriesScroll: {
    marginBottom: 15,
  },
  subcategoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  subcategoryButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  productCard: {
    marginBottom: 0,
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
    fontSize: 11,
    marginBottom: 2,
  },
  productName: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 12,
    fontWeight: "600",
  },
});

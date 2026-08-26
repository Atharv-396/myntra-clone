import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  fetchRecommendations,
  RecommendedProduct,
} from "@/utils/recommendationService";
import { useTheme } from "@/theme";

interface YouMayAlsoLikeSectionProps {
  currentProductId?: string;
  userId?: string;
  limit?: number;
}

export default function YouMayAlsoLikeSection({
  currentProductId,
  userId,
  limit = 10,
}: YouMayAlsoLikeSectionProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchRecommendations(userId, currentProductId, limit);
        if (!cancelled) setProducts(data);
      } catch {
        // Handled silently
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, currentProductId, limit]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>YOU MAY ALSO LIKE</Text>
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>YOU MAY ALSO LIKE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {products.map((product) => (
          <TouchableOpacity
            key={product._id}
            style={[
              styles.card,
              {
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
              style={styles.image}
            />
            <Text style={[styles.brand, { color: theme.colors.textTertiary }]} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: theme.colors.textPrimary }]}>₹{product.price}</Text>
              {product.discount ? (
                <Text style={[styles.discount, { color: theme.colors.primary }]}>{product.discount}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
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
    width: 130,
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
    paddingBottom: 8,
  },
  image: {
    width: 130,
    height: 155,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  brand: {
    fontSize: 11,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  name: {
    fontSize: 12,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    marginTop: 4,
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: "bold",
  },
  discount: {
    fontSize: 11,
  },
});

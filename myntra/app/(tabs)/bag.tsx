import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ShoppingBag, Minus, Plus, Trash2, Bookmark, BookmarkCheck } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  CartItem, fetchCart, removeFromCart, updateCartQuantity,
  saveForLater, moveToCart, clearCart, validateCart,
  CartTotals, PriceChange, StockWarning,
} from "@/utils/cartService";
import { getGuestCart, addToGuestCart, removeFromGuestCart, updateGuestCartQuantity } from "@/utils/guestCartStorage";
import BASE_URL from "@/config/api";
import axios from "axios";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

export default function Bag() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { headerPaddingTop, footerPaddingBottom, isTablet } = useResponsive();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartItem[]>([]);
  const [guestItems, setGuestItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([]);

  const totals: CartTotals | null = useMemo(() => {
    if (cartItems.length === 0) return null;
    const activeItems = cartItems.filter((i) => !i.unavailable);
    const subtotal = activeItems.reduce(
      (s, i) => s + (i.productId?.price || 0) * i.quantity,
      0
    );
    const shipping = subtotal > 0 && subtotal < 999 ? 99 : 0;
    return {
      subtotal,
      shipping,
      grandTotal: subtotal + shipping,
      itemCount: activeItems.reduce((s, i) => s + i.quantity, 0),
      priceChanges: [],
    };
  }, [cartItems]);

  const loadCart = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      try {
        const items = await fetchCart(user._id);
        setCartItems(items.filter((i) => !i.savedForLater));
        setSavedItems(items.filter((i) => i.savedForLater));
      } catch (e) {
        console.log("loadCart error:", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      const items = await getGuestCart();
      setGuestItems(items);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [loadCart])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  }, [loadCart]);

  const handleUpdateQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty < 1) return;
    setUpdatingId(itemId);
    try {
      const updated = await updateCartQuantity(itemId, newQty);
      setCartItems((prev) => prev.map((i) => (i._id === itemId ? updated : i)));
    } catch (e) {
      console.log(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      await removeFromCart(itemId);
      setCartItems((prev) => prev.filter((i) => i._id !== itemId));
      setSavedItems((prev) => prev.filter((i) => i._id !== itemId));
    } catch (e) {
      console.log(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveForLater = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      const updated = await saveForLater(itemId);
      setCartItems((prev) => prev.filter((i) => i._id !== itemId));
      setSavedItems((prev) => [updated, ...prev]);
    } catch (e) {
      console.log(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMoveToCart = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      const updated = await moveToCart(itemId);
      setSavedItems((prev) => prev.filter((i) => i._id !== itemId));
      setCartItems((prev) => {
        const exists = prev.find((i) => i._id === updated._id);
        return exists ? prev.map((i) => (i._id === updated._id ? updated : i)) : [updated, ...prev];
      });
    } catch (e) {
      console.log(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          try {
            await clearCart(user._id);
            setCartItems([]);
            setSavedItems([]);
          } catch (e: any) {
            console.log("clearCart error:", JSON.stringify(e?.response?.data), e?.message);
            // If the API call fails, fall back to removing items one by one
            try {
              await Promise.all([
                ...cartItems.map((item) => removeFromCart(item._id)),
                ...savedItems.map((item) => removeFromCart(item._id)),
              ]);
              setCartItems([]);
              setSavedItems([]);
            } catch (fallbackErr) {
              Alert.alert("Error", "Could not clear cart. Please try again.");
            }
          }
        },
      },
    ]);
  };

  const handleCheckout = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert("Cart is empty");
      return;
    }
    try {
      const result = await validateCart(user._id);
      if (result.priceChanges.length > 0) {
        const names = result.priceChanges
          .map((p) => `${p.productName}: \u20B9${p.oldPrice}\u2192\u20B9${p.newPrice}`)
          .join("\n");
        Alert.alert("Price Updated", `Some prices have changed:\n${names}\n\nProceeding with new prices.`);
        setPriceChanges(result.priceChanges);
        await loadCart();
      }
      if (result.warnings.length > 0) {
        const warns = result.warnings.map((w) => w.message).join("\n");
        Alert.alert("Stock Warning", warns);
        setStockWarnings(result.warnings);
        return;
      }
      if (!result.canCheckout) {
        Alert.alert("Cannot Checkout", "Some items are unavailable. Please review your cart.");
        return;
      }
      router.push("/checkout");
    } catch (e: any) {
      Alert.alert("Checkout Error", e?.response?.data?.message || "Could not validate cart");
    }
  };

  const handleGuestDelete = async (item: any) => {
    await removeFromGuestCart(item.productId, item.size, item.color);
    setGuestItems((prev) =>
      prev.filter((i) => !(i.productId === item.productId && i.size === item.size && i.color === item.color))
    );
  };

  const handleGuestQty = async (item: any, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    await updateGuestCartQuantity(item.productId, item.size, item.color, newQty);
    setGuestItems((prev) =>
      prev.map((i) =>
        i.productId === item.productId && i.size === item.size && i.color === item.color
          ? { ...i, quantity: newQty }
          : i
      )
    );
  };

  if (!user) {
    const guestTotal = guestItems.reduce((s, i) => s + (i.priceAtAdd || 0) * (i.quantity || 1), 0);
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Shopping Bag</Text>
        </View>

        <TouchableOpacity
          style={[styles.loginBanner, { backgroundColor: theme.isDark ? "#252525" : "#FFF8F0", borderColor: theme.isDark ? "#333" : "#FFE0B2" }]}
          onPress={() => router.push("/login")}
          activeOpacity={0.8}
        >
          <Text style={[styles.loginBannerText, { color: theme.colors.textSecondary }]}>
            Login to sync your cart across devices & get personalized offers
          </Text>
          <Text style={[styles.loginBannerLink, { color: theme.colors.primary }]}>LOG IN</Text>
        </TouchableOpacity>

        {guestItems.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={64} color={theme.colors.primary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>Your shopping bag is empty</Text>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push("/")}
              activeOpacity={0.8}
            >
              <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>SHOP NOW</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView style={styles.content}>
              {guestItems.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.bagItem,
                    { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider },
                  ]}
                >
                  <Image source={{ uri: item.image }} style={styles.itemImage} />
                  <View style={styles.itemInfo}>
                    <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{item.brand}</Text>
                    <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.itemSize, { color: theme.colors.textSecondary }]}>Size: {item.size}</Text>
                    <Text style={[styles.itemPrice, { color: theme.colors.textPrimary }]}>&#x20B9;{item.priceAtAdd}</Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity
                        style={[styles.quantityButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                        onPress={() => handleGuestQty(item, -1)}
                      >
                        <Minus size={14} color={theme.colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.quantity, { color: theme.colors.textPrimary }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={[styles.quantityButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                        onPress={() => handleGuestQty(item, 1)}
                      >
                        <Plus size={14} color={theme.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleGuestDelete(item)}
                      >
                        <Trash2 size={18} color={theme.colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.divider, paddingBottom: footerPaddingBottom }]}>
              <View style={styles.totalContainer}>
                <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Estimated Total</Text>
                <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>&#x20B9;{guestTotal}</Text>
              </View>
              <TouchableOpacity
                style={[styles.checkoutButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push("/login")}
                activeOpacity={0.8}
              >
                <Text style={[styles.checkoutButtonText, { color: theme.colors.primaryText }]}>LOGIN TO CHECKOUT</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (cartItems.length === 0 && savedItems.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Shopping Bag</Text>
        </View>
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color={theme.colors.primary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>Your shopping bag is empty</Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/")}
            activeOpacity={0.8}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>SHOP NOW</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderCartItem = (item: CartItem, isSavedSection: boolean) => {
    const product = item.productId;
    const isBusy = updatingId === item._id;

    return (
      <View
        key={item._id}
        style={[
          styles.bagItem,
          { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider },
          item.unavailable && styles.unavailableItem,
        ]}
      >
        <TouchableOpacity
          onPress={() => product?._id && router.push(`/product/${product._id}`)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: product?.images?.[0] }} style={styles.itemImage} />
        </TouchableOpacity>

        <View style={styles.itemInfo}>
          <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{product?.brand}</Text>
          <Text style={[styles.itemName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {product?.name}
          </Text>

          {item.size ? (
            <Text style={[styles.itemSize, { color: theme.colors.textSecondary }]}>Size: {item.size}</Text>
          ) : null}

          <Text style={[styles.itemPrice, { color: theme.colors.textPrimary }]}>&#x20B9;{product?.price}</Text>

          {!isSavedSection && (
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => handleUpdateQuantity(item._id, item.quantity, -1)}
                disabled={isBusy || item.quantity <= 1}
              >
                <Minus size={14} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.quantity, { color: theme.colors.textPrimary }]}>{item.quantity}</Text>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => handleUpdateQuantity(item._id, item.quantity, 1)}
                disabled={isBusy}
              >
                <Plus size={14} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actionRow}>
            {!isSavedSection ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleSaveForLater(item._id)}
                disabled={isBusy}
                activeOpacity={0.7}
              >
                <Bookmark size={15} color={theme.colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: theme.colors.textSecondary }]}>Save for later</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleMoveToCart(item._id)}
                disabled={isBusy}
                activeOpacity={0.7}
              >
                <BookmarkCheck size={15} color={theme.colors.primary} />
                <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Move to cart</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleRemove(item._id)}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              <Trash2 size={15} color={theme.colors.error} />
              <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Shopping Bag ({cartItems.length})
        </Text>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={[styles.clearText, { color: theme.colors.primary }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {cartItems.map((item) => renderCartItem(item, false))}
        {savedItems.length > 0 && (
          <>
            <View style={[styles.sectionDivider, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Text style={[styles.sectionDividerText, { color: theme.colors.textSecondary }]}>
                SAVED FOR LATER ({savedItems.length})
              </Text>
            </View>
            {savedItems.map((item) => renderCartItem(item, true))}
          </>
        )}
      </ScrollView>

      {cartItems.length > 0 && totals && (
        <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.divider, paddingBottom: footerPaddingBottom }]}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Subtotal</Text>
              <Text style={[styles.totalValue, { color: theme.colors.textPrimary }]}>&#x20B9;{totals.subtotal}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Shipping</Text>
              <Text style={[styles.totalValue, { color: theme.colors.textPrimary }]}>
                {totals.shipping === 0 ? "FREE" : `\u20B9${totals.shipping}`}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: theme.colors.divider }]}>
              <Text style={[styles.grandTotalLabel, { color: theme.colors.textPrimary }]}>Total</Text>
              <Text style={[styles.grandTotalValue, { color: theme.colors.primary }]}>&#x20B9;{totals.grandTotal}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleCheckout}
            activeOpacity={0.8}
          >
            <Text style={[styles.checkoutButtonText, { color: theme.colors.primaryText }]}>PLACE ORDER</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  clearText: { fontSize: 14, fontWeight: "600" },
  content: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, marginTop: 80 },
  emptyTitle: { fontSize: 18, marginTop: 16, marginBottom: 20, fontWeight: "bold" },
  loginButton: { paddingHorizontal: 30, paddingVertical: 14, borderRadius: 8 },
  loginButtonText: { fontSize: 15, fontWeight: "bold" },
  loginBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, marginVertical: 8, marginHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  loginBannerText: { fontSize: 13, flex: 1 },
  loginBannerLink: { fontSize: 13, fontWeight: "bold", marginLeft: 10 },
  sectionDivider: { paddingVertical: 10, paddingHorizontal: 15, marginTop: 8 },
  sectionDividerText: { fontSize: 12, fontWeight: "bold", letterSpacing: 0.5 },
  bagItem: { flexDirection: "row", marginHorizontal: 0, marginBottom: 1, padding: 12, borderBottomWidth: 1 },
  unavailableItem: { opacity: 0.6 },
  itemImage: { width: 90, height: 110, borderRadius: 6 },
  itemInfo: { flex: 1, paddingLeft: 12 },
  brandName: { fontSize: 12, marginBottom: 2 },
  itemName: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  itemSize: { fontSize: 12, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: "bold", marginBottom: 8 },
  quantityContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  quantityButton: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  quantity: { marginHorizontal: 12, fontSize: 14, fontWeight: "600" },
  removeButton: { marginLeft: "auto" },
  actionRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: "500" },
  footer: { borderTopWidth: 1, padding: 15 },
  totalsBox: { marginBottom: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: "500" },
  grandTotalRow: { borderTopWidth: 1, marginTop: 6, paddingTop: 8 },
  grandTotalLabel: { fontSize: 16, fontWeight: "bold" },
  grandTotalValue: { fontSize: 18, fontWeight: "bold" },
  totalContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  totalAmount: { fontSize: 18, fontWeight: "bold" },
  checkoutButton: { padding: 14, borderRadius: 10, alignItems: "center" },
  checkoutButtonText: { fontSize: 15, fontWeight: "bold" },
});

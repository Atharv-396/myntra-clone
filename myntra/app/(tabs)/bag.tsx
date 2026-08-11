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

export default function Bag() {
  const router = useRouter();
  const { user } = useAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartItem[]>([]);
  const [guestItems, setGuestItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([]);

  // ── Derived totals — recalculates automatically whenever cartItems changes ──
  // This is the fix: totals are derived from cartItems state, not stored
  // separately. Every quantity change, delete, or move instantly updates totals.
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

  // ── Load cart ──────────────────────────────────────────────────────────────
  const loadCart = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      try {
        const items = await fetchCart(user._id);
        setCartItems(items.filter((i) => !i.savedForLater));
        setSavedItems(items.filter((i) => i.savedForLater));
        // Totals are now derived via useMemo — no manual calculation needed here
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

  useFocusEffect(useCallback(() => { loadCart(); }, [loadCart]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  }, [loadCart]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      await removeFromCart(itemId);
      setCartItems((prev) => prev.filter((i) => i._id !== itemId));
      setSavedItems((prev) => prev.filter((i) => i._id !== itemId));
    } catch (e) { console.log(e); }
    finally { setUpdatingId(null); }
  };

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setUpdatingId(item._id);
    try {
      await updateCartQuantity(item._id, newQty);
      setCartItems((prev) => prev.map((i) => i._id === item._id ? { ...i, quantity: newQty } : i));
    } catch (e: any) {
      Alert.alert("Cannot update", e?.response?.data?.message || "Error updating quantity");
    } finally { setUpdatingId(null); }
  };

  const handleSaveForLater = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      const updated = await saveForLater(itemId);
      setCartItems((prev) => prev.filter((i) => i._id !== itemId));
      setSavedItems((prev) => [updated, ...prev]);
    } catch (e) { console.log(e); }
    finally { setUpdatingId(null); }
  };

  const handleMoveToCart = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      const updated = await moveToCart(itemId);
      setSavedItems((prev) => prev.filter((i) => i._id !== itemId));
      setCartItems((prev) => {
        const exists = prev.find((i) => i._id === updated._id);
        return exists ? prev.map((i) => i._id === updated._id ? updated : i) : [updated, ...prev];
      });
    } catch (e) { console.log(e); }
    finally { setUpdatingId(null); }
  };

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => {
        if (!user) return;
        await clearCart(user._id);
        setCartItems([]);
        // totals automatically becomes null via useMemo when cartItems is empty
      }},
    ]);
  };

  const handleCheckout = async () => {
    if (!user) { router.push("/login"); return; }
    if (cartItems.length === 0) { Alert.alert("Cart is empty"); return; }
    try {
      const result = await validateCart(user._id);
      if (result.priceChanges.length > 0) {
        const names = result.priceChanges.map((p) => `${p.productName}: ₹${p.oldPrice}→₹${p.newPrice}`).join("\n");
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

  // ── Guest quantity handlers ────────────────────────────────────────────────
  const handleGuestDelete = async (item: any) => {
    await removeFromGuestCart(item.productId, item.size, item.color);
    setGuestItems((prev) => prev.filter((i) => !(i.productId === item.productId && i.size === item.size && i.color === item.color)));
  };

  const handleGuestQty = async (item: any, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    await updateGuestCartQuantity(item.productId, item.size, item.color, newQty);
    setGuestItems((prev) => prev.map((i) => i.productId === item.productId && i.size === item.size && i.color === item.color ? { ...i, quantity: newQty } : i));
  };

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) {
    const guestTotal = guestItems.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Shopping Bag</Text></View>
        {guestItems.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={64} color="#ff3f6c" />
            <Text style={styles.emptyTitle}>Your bag is empty</Text>
            <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/login")}>
              <Text style={styles.loginButtonText}>LOGIN TO SYNC BAG</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView style={styles.content}>
              {guestItems.map((item, idx) => (
                <View key={idx} style={styles.bagItem}>
                  <Image source={{ uri: item.productImage }} style={styles.itemImage} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.brandName}>{item.productBrand}</Text>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemSize}>Size: {item.size}{item.color ? ` · ${item.color}` : ""}</Text>
                    <Text style={styles.itemPrice}>₹{item.priceAtAdd}</Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.quantityButton} onPress={() => handleGuestQty(item, -1)}><Minus size={16} color="#3e3e3e" /></TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.quantityButton} onPress={() => handleGuestQty(item, 1)}><Plus size={16} color="#3e3e3e" /></TouchableOpacity>
                      <TouchableOpacity style={styles.removeButton} onPress={() => handleGuestDelete(item)}><Trash2 size={18} color="#ff3f6c" /></TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.loginBanner}>
                <Text style={styles.loginBannerText}>Login to save your bag across devices</Text>
                <TouchableOpacity onPress={() => router.push("/login")}><Text style={styles.loginBannerLink}>LOGIN</Text></TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>₹{guestTotal}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutButton} onPress={() => router.push("/login")}>
                <Text style={styles.checkoutButtonText}>LOGIN TO CHECKOUT</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  if (isLoading) {
    return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#ff3f6c" /></View>;
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (cartItems.length === 0 && savedItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Shopping Bag</Text></View>
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color="#ff3f6c" />
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/")}>
            <Text style={styles.loginButtonText}>START SHOPPING</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render cart item ───────────────────────────────────────────────────────
  const renderCartItem = (item: CartItem, isSaved: boolean) => {
    const product = item.productId;
    const isUpdating = updatingId === item._id;
    const hasPriceChange = priceChanges.find((p) => p.itemId === item._id);
    const hasStockWarn = stockWarnings.find((w) => w.itemId === item._id);

    return (
      <View key={item._id} style={[styles.bagItem, item.unavailable && styles.unavailableItem]}>
        <Image source={{ uri: product?.images?.[0] }} style={styles.itemImage} />
        <View style={styles.itemInfo}>
          {item.unavailable && (
            <View style={styles.unavailableBadge}><Text style={styles.unavailableText}>{item.unavailableReason || "Unavailable"}</Text></View>
          )}
          {hasPriceChange && (
            <View style={styles.priceChangeBadge}><Text style={styles.priceChangeText}>Price updated: ₹{hasPriceChange.oldPrice}→₹{hasPriceChange.newPrice}</Text></View>
          )}
          {hasStockWarn && (
            <View style={styles.stockWarnBadge}><Text style={styles.stockWarnText}>{hasStockWarn.message}</Text></View>
          )}
          <Text style={styles.brandName}>{product?.brand}</Text>
          <Text style={styles.itemName}>{product?.name}</Text>
          <Text style={styles.itemSize}>Size: {item.size}{item.color ? ` · ${item.color}` : ""}</Text>
          <Text style={styles.itemPrice}>₹{product?.price}</Text>
          {!isSaved && !item.unavailable && (
            <View style={styles.quantityContainer}>
              <TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(item, -1)} disabled={isUpdating}>
                <Minus size={16} color="#3e3e3e" />
              </TouchableOpacity>
              {isUpdating ? <ActivityIndicator size="small" color="#ff3f6c" style={{ marginHorizontal: 10 }} /> : <Text style={styles.quantity}>{item.quantity}</Text>}
              <TouchableOpacity style={styles.quantityButton} onPress={() => handleQuantityChange(item, 1)} disabled={isUpdating}>
                <Plus size={16} color="#3e3e3e" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item._id)} disabled={isUpdating}>
              <Trash2 size={16} color="#ff3f6c" />
              <Text style={styles.actionBtnText}>Remove</Text>
            </TouchableOpacity>
            {!isSaved ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleSaveForLater(item._id)} disabled={isUpdating}>
                <Bookmark size={16} color="#666" />
                <Text style={styles.actionBtnText}>Save for Later</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleMoveToCart(item._id)} disabled={isUpdating}>
                <ShoppingBag size={16} color="#ff3f6c" />
                <Text style={[styles.actionBtnText, { color: "#ff3f6c" }]}>Move to Cart</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Bag ({cartItems.length})</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}><Text style={styles.clearText}>Clear</Text></TouchableOpacity>
        )}
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#ff3f6c"]} />}>
        {cartItems.map((item) => renderCartItem(item, false))}
        {savedItems.length > 0 && (
          <>
            <View style={styles.sectionDivider}><Text style={styles.sectionDividerText}>SAVED FOR LATER ({savedItems.length})</Text></View>
            {savedItems.map((item) => renderCartItem(item, true))}
          </>
        )}
      </ScrollView>
      {cartItems.length > 0 && totals && (
        <View style={styles.footer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>₹{totals.subtotal}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Shipping</Text><Text style={styles.totalValue}>{totals.shipping === 0 ? "FREE" : `₹${totals.shipping}`}</Text></View>
            <View style={[styles.totalRow, styles.grandTotalRow]}><Text style={styles.grandTotalLabel}>Total</Text><Text style={styles.grandTotalValue}>₹{totals.grandTotal}</Text></View>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.checkoutButtonText}>PLACE ORDER</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15, paddingTop: 50, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#3e3e3e" },
  clearText: { fontSize: 14, color: "#ff3f6c" },
  content: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 18, color: "#3e3e3e", marginTop: 16, marginBottom: 20 },
  loginButton: { backgroundColor: "#ff3f6c", paddingHorizontal: 30, paddingVertical: 14, borderRadius: 8 },
  loginButtonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  loginBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff8f0", padding: 14, marginVertical: 8, marginHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ffe0b2" },
  loginBannerText: { fontSize: 13, color: "#666", flex: 1 },
  loginBannerLink: { fontSize: 13, fontWeight: "bold", color: "#ff3f6c", marginLeft: 10 },
  sectionDivider: { backgroundColor: "#f0f0f0", paddingVertical: 10, paddingHorizontal: 15, marginTop: 8 },
  sectionDividerText: { fontSize: 13, fontWeight: "bold", color: "#666", letterSpacing: 0.5 },
  bagItem: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 0, marginBottom: 2, padding: 12 },
  unavailableItem: { opacity: 0.6 },
  itemImage: { width: 90, height: 110, borderRadius: 6, backgroundColor: "#f5f5f5" },
  itemInfo: { flex: 1, paddingLeft: 12 },
  unavailableBadge: { backgroundColor: "#ffeef0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: "flex-start", marginBottom: 4 },
  unavailableText: { fontSize: 11, color: "#cc0000" },
  priceChangeBadge: { backgroundColor: "#fff3cd", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: "flex-start", marginBottom: 4 },
  priceChangeText: { fontSize: 11, color: "#856404" },
  stockWarnBadge: { backgroundColor: "#fff3cd", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: "flex-start", marginBottom: 4 },
  stockWarnText: { fontSize: 11, color: "#856404" },
  brandName: { fontSize: 13, color: "#888", marginBottom: 3 },
  itemName: { fontSize: 15, color: "#3e3e3e", marginBottom: 4 },
  itemSize: { fontSize: 13, color: "#666", marginBottom: 4 },
  itemPrice: { fontSize: 16, fontWeight: "bold", color: "#3e3e3e", marginBottom: 8 },
  quantityContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  quantityButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  quantity: { marginHorizontal: 12, fontSize: 15, fontWeight: "600", color: "#3e3e3e" },
  removeButton: { marginLeft: "auto" },
  actionRow: { flexDirection: "row", gap: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtnText: { fontSize: 13, color: "#666" },
  footer: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0f0f0", padding: 15 },
  totalsBox: { marginBottom: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 14, color: "#666" },
  totalValue: { fontSize: 14, color: "#3e3e3e" },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: "#f0f0f0", marginTop: 6, paddingTop: 8 },
  grandTotalLabel: { fontSize: 16, fontWeight: "bold", color: "#3e3e3e" },
  grandTotalValue: { fontSize: 18, fontWeight: "bold", color: "#ff3f6c" },
  totalContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  totalAmount: { fontSize: 18, fontWeight: "bold", color: "#3e3e3e" },
  checkoutButton: { backgroundColor: "#ff3f6c", padding: 15, borderRadius: 10, alignItems: "center" },
  checkoutButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

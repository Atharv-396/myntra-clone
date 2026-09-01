import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useRouter } from "expo-router";
import { CreditCard, MapPin, Truck, CircleAlert, ChevronLeft, ShieldCheck, Check, Banknote, ShoppingBag } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { fetchCheckoutSummary, CheckoutSummary } from "@/utils/cartService";
import { useTheme } from "@/theme";
import CashfreeCheckoutModal from "@/components/CashfreeCheckoutModal";
import {
  createCashfreePaymentOrder,
  verifyCashfreePayment,
  CashfreeOrderResponse,
} from "@/utils/paymentService";
import { useResponsive } from "@/hooks/useResponsive";

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Dynamic Shipping Address State
  const [fullName, setFullName] = useState("John Doe");
  const [address1, setAddress1] = useState("123 Main Street");
  const [address2, setAddress2] = useState("Apt 4B");
  const [city, setCity] = useState("Bengaluru");
  const [stateName, setStateName] = useState("Karnataka");
  const [postalCode, setPostalCode] = useState("560001");
  const [phone, setPhone] = useState("9876543210");

  // Payment Method Selection
  const [paymentMethod, setPaymentMethod] = useState<"CASHFREE" | "COD">("CASHFREE");

  // Cashfree Modal State
  const [cashfreeModalVisible, setCashfreeModalVisible] = useState(false);
  const [cashfreeOrderData, setCashfreeOrderData] = useState<CashfreeOrderResponse | null>(null);

  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { headerPaddingTop, footerPaddingBottom, width, isTablet } = useResponsive();

  const formattedAddress = `${fullName}, ${address1}, ${address2 ? address2 + ", " : ""}${city}, ${stateName} - ${postalCode}, Phone: ${phone}`;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const data = await fetchCheckoutSummary(user._id);
        if (data.priceChanges.length > 0) {
          const changes = data.priceChanges
            .map((p) => `• ${p.productName}: ₹${p.oldPrice} → ₹${p.newPrice}`)
            .join("\n");
          Alert.alert("Price Updated", `Some prices have changed:\n\n${changes}\n\nCheckout total has been updated.`);
        }
        setSummary(data);
      } catch (e: any) {
        const msg = e?.response?.data?.message || "Could not load checkout summary";
        setSummaryError(msg);
      } finally {
        setSummaryLoading(false);
      }
    };
    load();
  }, [user]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/bag");
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) { router.push("/login"); return; }
    if (!summary || !summary.canCheckout || !summary.items || summary.items.length === 0) {
      Alert.alert("Your bag is empty", "Please add items to your bag before proceeding to checkout.");
      router.push("/(tabs)/bag");
      return;
    }

    if (!address1.trim() || !city.trim() || !postalCode.trim()) {
      Alert.alert("Incomplete Address", "Please provide complete shipping address details.");
      return;
    }

    setLoading(true);

    if (paymentMethod === "CASHFREE") {
      // Step 1: Initiate Cashfree Payment
      try {
        const cfOrder = await createCashfreePaymentOrder(user._id, formattedAddress, phone);
        setCashfreeOrderData(cfOrder);
        setCashfreeModalVisible(true);
      } catch (error: any) {
        console.error("Cashfree Order creation failed:", error);
        Alert.alert("Payment Initiation Failed", error?.response?.data?.message || error.message || "Failed to connect to Cashfree");
      } finally {
        setLoading(false);
      }
    } else {
      // Cash On Delivery Flow
      try {
        await axios.post(`${BASE_URL}/order/create/${user._id}`, {
          shippingAddress: formattedAddress,
          paymentMethod: "Cash on Delivery",
        });
        Alert.alert("Order Placed", "Your order has been placed successfully via Cash on Delivery!");
        router.push("/orders");
      } catch (error: any) {
        Alert.alert("Order failed", error?.response?.data?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
  };

  // Step 2: Handle Cashfree Payment Success Callback
  const handleCashfreeSuccess = async (paymentId: string) => {
    if (!user || !cashfreeOrderData) return;
    setCashfreeModalVisible(false);
    setLoading(true);

    try {
      const verifyRes = await verifyCashfreePayment({
        orderId: cashfreeOrderData.orderId,
        userId: user._id,
        shippingAddress: formattedAddress,
        paymentMethod: "CASHFREE",
        paymentId,
      });

      if (verifyRes.success) {
        Alert.alert(
          "Payment Successful 🎉",
          `Order #${verifyRes.orderId.slice(-6).toUpperCase()} placed successfully! Total: ₹${verifyRes.total}`,
          [{ text: "VIEW ORDERS", onPress: () => router.push("/orders") }]
        );
      } else {
        Alert.alert("Payment Verification Failed", verifyRes.message || "Please contact support.");
      }
    } catch (error: any) {
      console.error("Payment Verification Error:", error);
      Alert.alert("Payment Verification Error", error?.response?.data?.message || "Could not verify payment with server.");
    } finally {
      setLoading(false);
    }
  };

  const handleCashfreeFailure = (errorMsg: string) => {
    setCashfreeModalVisible(false);
    Alert.alert("Payment Incomplete", errorMsg || "The transaction was cancelled or failed.");
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Checkout</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Please login to checkout</Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.primaryText }]}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!summaryLoading && (summaryError?.toLowerCase().includes("empty") || (summary && summary.items.length === 0))) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Checkout</Text>
        </View>
        <View style={styles.centerState}>
          <ShoppingBag size={56} color={theme.colors.textTertiary} />
          <Text style={[{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 6 }]}>
            Your Bag is Empty
          </Text>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 20, textAlign: "center" }}>
            Add items to your bag before proceeding to checkout.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/(tabs)/bag")}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.primaryText }]}>VIEW BAG</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={theme.colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Checkout</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Shipping Address */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <MapPin size={22} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Shipping Address</Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.placeholder}
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Address Line 1"
              placeholderTextColor={theme.colors.placeholder}
              value={address1}
              onChangeText={setAddress1}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Address Line 2 (Optional)"
              placeholderTextColor={theme.colors.placeholder}
              value={address2}
              onChangeText={setAddress2}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="City"
                placeholderTextColor={theme.colors.placeholder}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="State"
                placeholderTextColor={theme.colors.placeholder}
                value={stateName}
                onChangeText={setStateName}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="Postal Code"
                placeholderTextColor={theme.colors.placeholder}
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="Mobile Number"
                placeholderTextColor={theme.colors.placeholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <CreditCard size={22} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Payment Options</Text>
          </View>

          {/* Cashfree Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              { borderColor: paymentMethod === "CASHFREE" ? theme.colors.primary : theme.colors.border },
              paymentMethod === "CASHFREE" && { backgroundColor: theme.isDark ? "#2A1D24" : "#FFF5F7" },
            ]}
            onPress={() => setPaymentMethod("CASHFREE")}
            activeOpacity={0.8}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.radioCircle, { borderColor: paymentMethod === "CASHFREE" ? theme.colors.primary : theme.colors.textTertiary }]}>
                {paymentMethod === "CASHFREE" && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Cashfree Payments</Text>
                  <View style={styles.secureTag}>
                    <ShieldCheck size={12} color="#2E7D32" />
                    <Text style={styles.secureTagText}>SECURE</Text>
                  </View>
                </View>
                <Text style={[styles.optionSub, { color: theme.colors.textSecondary }]}>
                  UPI (GPay/PhonePe/Paytm), Cards, NetBanking, Wallets
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* COD Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              { borderColor: paymentMethod === "COD" ? theme.colors.primary : theme.colors.border },
              paymentMethod === "COD" && { backgroundColor: theme.isDark ? "#2A1D24" : "#FFF5F7" },
            ]}
            onPress={() => setPaymentMethod("COD")}
            activeOpacity={0.8}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.radioCircle, { borderColor: paymentMethod === "COD" ? theme.colors.primary : theme.colors.textTertiary }]}>
                {paymentMethod === "COD" && <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Cash on Delivery (COD)</Text>
                  <Banknote size={16} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.optionSub, { color: theme.colors.textSecondary }]}>
                  Pay with cash upon delivery at your doorstep
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <Truck size={22} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Order Summary</Text>
          </View>

          {summaryLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : summaryError ? (
            <View style={[styles.errorBox, { backgroundColor: theme.isDark ? "#3A1B1F" : "#FFEEF0" }]}>
              <CircleAlert size={18} color={theme.colors.error} />
              <Text style={[styles.errorBoxText, { color: theme.colors.error }]}>{summaryError}</Text>
            </View>
          ) : summary ? (
            <>
              {summary.invalidItems.length > 0 && (
                <View style={[styles.warningBox, { backgroundColor: theme.isDark ? "#3A2E1A" : "#FFF3CD" }]}>
                  <CircleAlert size={16} color={theme.colors.warning} />
                  <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                    {summary.invalidItems.map((i) => i.productName).join(", ")}{" "}
                    {summary.invalidItems.length === 1 ? "is" : "are"} unavailable
                  </Text>
                </View>
              )}

              {summary.warnings.length > 0 && (
                <View style={[styles.warningBox, { backgroundColor: theme.isDark ? "#3A2E1A" : "#FFF3CD" }]}>
                  <CircleAlert size={16} color={theme.colors.warning} />
                  <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                    {summary.warnings.map((w) => w.message).join(". ")}
                  </Text>
                </View>
              )}

              {summary.items.map((item) => (
                <View key={item._id} style={styles.lineItem}>
                  <Text style={[styles.lineItemName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {item.brand} {item.name} × {item.quantity}
                    {item.size ? ` (${item.size})` : ""}
                  </Text>
                  <Text style={[styles.lineItemPrice, { color: theme.colors.textPrimary }]}>₹{item.lineTotal}</Text>
                </View>
              ))}

              <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>₹{summary.subtotal}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Shipping</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
                  {summary.shipping === 0 ? "FREE" : `₹${summary.shipping}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>GST ({Math.round(summary.taxRate * 100)}%)</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>₹{summary.tax}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: theme.colors.divider }]}>
                <Text style={[styles.totalLabel, { color: theme.colors.textPrimary }]}>Total Payable</Text>
                <Text style={[styles.totalValue, { color: theme.colors.primary }]}>₹{summary.grandTotal}</Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Footer / Action Button */}
      <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.divider, paddingBottom: footerPaddingBottom }]}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            { backgroundColor: theme.colors.primary },
            (!summary?.canCheckout || loading) && styles.disabledButton,
          ]}
          onPress={handlePlaceOrder}
          disabled={!summary?.canCheckout || loading || summaryLoading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text style={[styles.placeOrderButtonText, { color: theme.colors.primaryText }]}>
              {summary?.canCheckout === false
                ? "RESOLVE CART ISSUES"
                : paymentMethod === "CASHFREE"
                ? `PAY VIA CASHFREE • ₹${summary?.grandTotal || ""}`
                : `PLACE ORDER (COD) • ₹${summary?.grandTotal || ""}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Cashfree Payment Modal */}
      <CashfreeCheckoutModal
        visible={cashfreeModalVisible}
        orderData={cashfreeOrderData}
        onSuccess={handleCashfreeSuccess}
        onFailure={handleCashfreeFailure}
        onClose={() => setCashfreeModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  content: { flex: 1, padding: 12 },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  errorText: { fontSize: 16, marginBottom: 20 },
  actionButton: { paddingHorizontal: 30, paddingVertical: 14, borderRadius: 8 },
  actionButtonText: { fontWeight: "bold", fontSize: 15 },
  section: { marginBottom: 12, borderRadius: 10, padding: 14, borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginLeft: 8 },
  form: { gap: 10 },
  input: { padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  halfInput: { width: "48%" },
  paymentOption: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  secureTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  secureTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D32",
  },
  optionSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
  errorBoxText: { fontSize: 13, flex: 1 },
  warningBox: { flexDirection: "row", alignItems: "flex-start", padding: 10, borderRadius: 8, marginBottom: 10, gap: 8 },
  warningText: { fontSize: 12, flex: 1 },
  lineItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  lineItemName: { fontSize: 13, flex: 1, marginRight: 8 },
  lineItemPrice: { fontSize: 13, fontWeight: "500" },
  divider: { height: 1, marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "500" },
  totalRow: { borderTopWidth: 1, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 16, fontWeight: "bold" },
  totalValue: { fontSize: 18, fontWeight: "bold" },
  footer: { padding: 14, borderTopWidth: 1 },
  placeOrderButton: { padding: 14, borderRadius: 10, alignItems: "center" },
  disabledButton: { opacity: 0.6 },
  placeOrderButtonText: { fontSize: 15, fontWeight: "bold" },
});


import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useRouter } from "expo-router";
import { CreditCard, MapPin, Truck, CircleAlert, ChevronLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { fetchCheckoutSummary, CheckoutSummary } from "@/utils/cartService";
import { useTheme } from "@/theme";

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();

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

  const handlePlaceOrder = async () => {
    if (!user) { router.push("/login"); return; }
    if (!summary || !summary.canCheckout) {
      Alert.alert("Cannot place order", "Please resolve cart issues before proceeding.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE_URL}/order/create/${user._id}`, {
        shippingAddress: "123 Main Street, Apt 4B, New York, NY, 10001",
        paymentMethod: "Card",
      });
      router.push("/orders");
    } catch (error: any) {
      Alert.alert("Order failed", error?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
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
              defaultValue="John Doe"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Address Line 1"
              placeholderTextColor={theme.colors.placeholder}
              defaultValue="123 Main Street"
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Address Line 2"
              placeholderTextColor={theme.colors.placeholder}
              defaultValue="Apt 4B"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="City"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="New York"
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="State"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="NY"
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="Postal Code"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="10001"
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="Country"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="United States"
              />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <CreditCard size={22} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Payment Method</Text>
          </View>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
              placeholder="Card Number"
              placeholderTextColor={theme.colors.placeholder}
              defaultValue="**** **** **** 4242"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="Expiry Date"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="12/25"
              />
              <TextInput
                style={[styles.input, styles.halfInput, { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary }]}
                placeholder="CVV"
                placeholderTextColor={theme.colors.placeholder}
                defaultValue="***"
              />
            </View>
          </View>
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

      <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.divider }]}>
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
              {summary?.canCheckout === false ? "RESOLVE CART ISSUES" : "PLACE ORDER"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", padding: 15, paddingTop: 50, borderBottomWidth: 1 },
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

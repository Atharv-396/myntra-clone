import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import BASE_URL from "@/config/api";
import { useRouter } from "expo-router";
import { CreditCard, MapPin, Truck, AlertCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { fetchCheckoutSummary, CheckoutSummary } from "@/utils/cartService";

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Load validated checkout summary from backend on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const data = await fetchCheckoutSummary(user._id);

        // Show price change alert if backend detected any
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
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.headerTitle}>Checkout</Text></View>
        <View style={styles.centerState}>
          <Text style={styles.errorText}>Please login to checkout</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/login")}>
            <Text style={styles.actionButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>
      <ScrollView style={styles.content}>

        {/* Shipping Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={24} color="#ff3f6c" />
            <Text style={styles.sectionTitle}>Shipping Address</Text>
          </View>
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Full Name" defaultValue="John Doe" />
            <TextInput style={styles.input} placeholder="Address Line 1" defaultValue="123 Main Street" />
            <TextInput style={styles.input} placeholder="Address Line 2" defaultValue="Apt 4B" />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="City" defaultValue="New York" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="State" defaultValue="NY" />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Postal Code" defaultValue="10001" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Country" defaultValue="United States" />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={24} color="#ff3f6c" />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Card Number" defaultValue="**** **** **** 4242" />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Expiry Date" defaultValue="12/25" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="CVV" defaultValue="***" />
            </View>
          </View>
        </View>

        {/* Order Summary — live from backend */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Truck size={24} color="#ff3f6c" />
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>

          {summaryLoading ? (
            <ActivityIndicator size="small" color="#ff3f6c" style={{ marginVertical: 20 }} />
          ) : summaryError ? (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color="#cc0000" />
              <Text style={styles.errorBoxText}>{summaryError}</Text>
            </View>
          ) : summary ? (
            <>
              {/* Invalid items warning */}
              {summary.invalidItems.length > 0 && (
                <View style={styles.warningBox}>
                  <AlertCircle size={16} color="#856404" />
                  <Text style={styles.warningText}>
                    {summary.invalidItems.map((i) => i.productName).join(", ")} {summary.invalidItems.length === 1 ? "is" : "are"} unavailable
                  </Text>
                </View>
              )}

              {/* Stock warnings */}
              {summary.warnings.length > 0 && (
                <View style={styles.warningBox}>
                  <AlertCircle size={16} color="#856404" />
                  <Text style={styles.warningText}>
                    {summary.warnings.map((w) => w.message).join(". ")}
                  </Text>
                </View>
              )}

              {/* Line items */}
              {summary.items.map((item) => (
                <View key={item._id} style={styles.lineItem}>
                  <Text style={styles.lineItemName} numberOfLines={1}>
                    {item.brand} {item.name} × {item.quantity}
                    {item.size ? ` (${item.size})` : ""}
                  </Text>
                  <Text style={styles.lineItemPrice}>₹{item.lineTotal}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              {/* Totals */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{summary.subtotal}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>
                  {summary.shipping === 0 ? "FREE" : `₹${summary.shipping}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST ({Math.round(summary.taxRate * 100)}%)</Text>
                <Text style={styles.summaryValue}>₹{summary.tax}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>₹{summary.grandTotal}</Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderButton, (!summary?.canCheckout || loading) && styles.disabledButton]}
          onPress={handlePlaceOrder}
          disabled={!summary?.canCheckout || loading || summaryLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderButtonText}>
              {summary?.canCheckout === false ? "RESOLVE CART ISSUES" : "PLACE ORDER"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { padding: 15, paddingTop: 50, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#3e3e3e" },
  content: { flex: 1, padding: 15 },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  errorText: { fontSize: 16, color: "#666", marginBottom: 20 },
  actionButton: { backgroundColor: "#ff3f6c", paddingHorizontal: 30, paddingVertical: 14, borderRadius: 8 },
  actionButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  section: { marginBottom: 20, backgroundColor: "#fff", borderRadius: 10, padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#3e3e3e", marginLeft: 10 },
  form: { gap: 10 },
  input: { backgroundColor: "#f5f5f5", padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  halfInput: { width: "48%" },
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffeef0", padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
  errorBoxText: { color: "#cc0000", fontSize: 14, flex: 1 },
  warningBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff3cd", padding: 10, borderRadius: 8, marginBottom: 10, gap: 8 },
  warningText: { color: "#856404", fontSize: 13, flex: 1 },
  lineItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  lineItemName: { fontSize: 14, color: "#3e3e3e", flex: 1, marginRight: 8 },
  lineItemPrice: { fontSize: 14, color: "#3e3e3e", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  summaryLabel: { fontSize: 15, color: "#666" },
  summaryValue: { fontSize: 15, color: "#3e3e3e" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#f0f0f0", marginTop: 8, paddingTop: 10 },
  totalLabel: { fontSize: 17, fontWeight: "bold", color: "#3e3e3e" },
  totalValue: { fontSize: 17, fontWeight: "bold", color: "#ff3f6c" },
  footer: { padding: 15, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  placeOrderButton: { backgroundColor: "#ff3f6c", padding: 15, borderRadius: 10, alignItems: "center" },
  disabledButton: { backgroundColor: "#ccc" },
  placeOrderButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

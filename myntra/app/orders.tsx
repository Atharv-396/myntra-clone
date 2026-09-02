import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Package,
  ChevronRight,
  MapPin,
  Truck,
  CreditCard,
  ChevronLeft,
  RotateCcw,
  FileText,
  XCircle,
  RefreshCcw,
} from "lucide-react-native";
import React from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ─── Invoice HTML generator ───────────────────────────────────────────────────
function buildInvoiceHtml(order: any): string {
  const invoiceNum = `INV-${order._id.slice(-8).toUpperCase()}`;
  const orderDate = new Date(order.date || order.createdAt).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const GST_RATE = 0.18;
  const subtotal = order.items?.reduce((s: number, i: any) => s + (i.price || i.productId?.price || 0) * (i.quantity || 1), 0) ?? 0;
  const shipping = order.total - Math.round(subtotal * (1 + GST_RATE)) > 0 ? 99 : 0;
  const tax = Math.round(subtotal * GST_RATE);

  const itemRows = (order.items ?? [])
    .map((item: any) => {
      const name = item.productId?.name ?? "Product";
      const brand = item.productId?.brand ?? "";
      const price = item.price ?? item.productId?.price ?? 0;
      const qty = item.quantity ?? 1;
      return `
        <tr>
          <td>${brand ? `<strong>${brand}</strong><br/>` : ""}${name}${item.size ? ` <span style="color:#888">(${item.size})</span>` : ""}</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:right">&#x20B9;${price.toLocaleString("en-IN")}</td>
          <td style="text-align:right">&#x20B9;${(price * qty).toLocaleString("en-IN")}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #FF3F6C; padding-bottom: 16px; }
    .brand { font-size: 28px; font-weight: 900; color: #FF3F6C; letter-spacing: 2px; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 18px; font-weight: 700; color: #333; }
    .invoice-meta p { color: #666; font-size: 12px; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-box { background: #f9f9f9; padding: 12px; border-radius: 8px; }
    .info-box p { font-size: 12px; color: #444; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #FF3F6C; color: white; }
    thead th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tbody td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    .totals-table { width: 300px; margin-left: auto; }
    .totals-table td { padding: 6px 12px; font-size: 13px; }
    .totals-table .grand { font-weight: 800; font-size: 15px; color: #FF3F6C; border-top: 2px solid #FF3F6C; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #E6F4EA; color: #1E7E34; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #aaa; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MYNTRA</div>
      <p style="color:#888;font-size:12px;margin-top:4px">Fashion &amp; Lifestyle</p>
    </div>
    <div class="invoice-meta">
      <h2>TAX INVOICE</h2>
      <p><strong>${invoiceNum}</strong></p>
      <p>Date: ${orderDate}</p>
      <p>Status: <span class="status-badge">${order.status}</span></p>
    </div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div>
        <div class="section-title">Ship To</div>
        <div class="info-box"><p>${(order.shippingAddress || "—").replace(/,/g, ",<br/>")}</p></div>
      </div>
      <div>
        <div class="section-title">Payment</div>
        <div class="info-box">
          <p><strong>Method:</strong> ${order.paymentMethod || "—"}</p>
          <p><strong>Status:</strong> ${order.paymentStatus || "—"}</p>
          ${order.tracking ? `<p><strong>Tracking:</strong> ${order.tracking.number || "—"}</p>` : ""}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Order Items</div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table class="totals-table">
      <tr><td>Subtotal</td><td style="text-align:right">&#x20B9;${subtotal.toLocaleString("en-IN")}</td></tr>
      <tr><td>Shipping</td><td style="text-align:right">${shipping === 0 ? "FREE" : `&#x20B9;${shipping}`}</td></tr>
      <tr><td>GST (18%)</td><td style="text-align:right">&#x20B9;${tax.toLocaleString("en-IN")}</td></tr>
      <tr class="grand"><td><strong>Total Payable</strong></td><td style="text-align:right"><strong>&#x20B9;${order.total?.toLocaleString("en-IN") ?? "—"}</strong></td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Thank you for shopping with Myntra! For support, contact support@myntra.com</p>
    <p style="margin-top:4px">This is a computer-generated invoice. No signature required.</p>
  </div>
</body>
</html>`;
}

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { headerPaddingTop } = useResponsive();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // orderId + action key

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const fetchOrders = async () => {
    if (!user) { setIsLoading(false); setOrders([]); return; }
    try {
      setIsLoading(true);
      const res = await axios.get(`${BASE_URL}/order/user/${user._id}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.log(error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [user?._id]);

  // ── PDF Invoice ─────────────────────────────────────────────────────────────
  const handleDownloadInvoice = async (order: any) => {
    const key = `${order._id}-invoice`;
    setActionLoading(key);
    try {
      const html = buildInvoiceHtml(order);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Invoice ${order._id.slice(-8).toUpperCase()}`,
        });
      } else {
        // Web fallback — open print dialog
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Invoice Error", e?.message || "Could not generate invoice.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reorder ─────────────────────────────────────────────────────────────────
  const handleReorder = async (order: any) => {
    if (!user) return;
    const key = `${order._id}-reorder`;
    setActionLoading(key);
    try {
      const res = await axios.post(`${BASE_URL}/order/${order._id}/reorder`, { userId: user._id });
      const { addedCount, skippedCount } = res.data;
      const msg = skippedCount > 0
        ? `${addedCount} item(s) added to bag. ${skippedCount} item(s) skipped (unavailable or out of stock).`
        : `${addedCount} item(s) added to bag successfully!`;
      Alert.alert("Reorder Complete", msg, [
        { text: "View Bag", onPress: () => router.push("/(tabs)/bag") },
        { text: "Stay Here", style: "cancel" },
      ]);
    } catch (e: any) {
      Alert.alert("Reorder Failed", e?.response?.data?.message || "Could not reorder. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Cancel Order ─────────────────────────────────────────────────────────────
  const handleCancelOrder = (order: any) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order #${order._id.slice(-8).toUpperCase()}?`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            if (!user) return;
            const key = `${order._id}-cancel`;
            setActionLoading(key);
            try {
              await axios.post(`${BASE_URL}/order/${order._id}/cancel`, {
                userId: user._id,
                reason: "Cancelled by customer",
              });
              Alert.alert("Order Cancelled", "Your order has been cancelled successfully.");
              fetchOrders();
            } catch (e: any) {
              Alert.alert("Cannot Cancel", e?.response?.data?.message || "Could not cancel order.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Return Request ────────────────────────────────────────────────────────────
  const handleReturnRequest = (order: any) => {
    Alert.alert(
      "Request Return",
      `Request a return for order #${order._id.slice(-8).toUpperCase()}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Request Return",
          onPress: async () => {
            if (!user) return;
            const key = `${order._id}-return`;
            setActionLoading(key);
            try {
              await axios.post(`${BASE_URL}/order/${order._id}/return`, {
                userId: user._id,
                reason: "Return requested by customer",
              });
              Alert.alert("Return Requested", "Your return request has been submitted. Our team will contact you shortly.");
              fetchOrders();
            } catch (e: any) {
              Alert.alert("Return Failed", e?.response?.data?.message || "Could not submit return request.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Status colour helper ─────────────────────────────────────────────────────
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Delivered": return { bg: theme.isDark ? "#1B3A26" : "#E6F4EA", color: theme.colors.success };
      case "Cancelled": return { bg: theme.isDark ? "#3A1B1F" : "#FFEEF0", color: theme.colors.error };
      case "Return Requested": return { bg: theme.isDark ? "#3A2E1A" : "#FFF3CD", color: theme.colors.warning };
      default: return { bg: theme.isDark ? "#1B2E3A" : "#E3F2FD", color: theme.colors.info };
    }
  };

  const CANCELLABLE = ["Processing", "Packed"];
  const RETURNABLE = ["Delivered"];

  if (isLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>My Orders</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Please login to view your orders</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={theme.colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>My Orders</Text>
      </View>

      <ScrollView style={styles.content}>
        {orders.length === 0 ? (
          <View style={styles.centerState}>
            <Package size={56} color={theme.colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No orders yet</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 20 }}>Your placed orders will appear here</Text>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push("/")}
              activeOpacity={0.8}
            >
              <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>START SHOPPING</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order: any) => {
            const statusStyle = getStatusStyle(order.status);
            const isExpanded = expandedOrder === order._id;
            const canCancel = CANCELLABLE.includes(order.status);
            const canReturn = RETURNABLE.includes(order.status) && order.returnStatus !== "Requested" && order.returnStatus !== "Approved";

            return (
              <View
                key={order._id}
                style={[styles.orderCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
              >
                {/* ── Order Header ── */}
                <TouchableOpacity
                  style={[styles.orderHeader, { borderBottomColor: theme.colors.divider }]}
                  onPress={() => toggleOrderDetails(order._id)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.orderId, { color: theme.colors.textPrimary }]}>
                      Order #{order._id.slice(-8).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDate, { color: theme.colors.textTertiary }]}>
                      {new Date(order.date || order.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.statusContainer, { backgroundColor: statusStyle.bg }]}>
                    <Package size={14} color={statusStyle.color} />
                    <Text style={[styles.orderStatus, { color: statusStyle.color }]}>{order.status}</Text>
                  </View>
                </TouchableOpacity>

                {/* ── Items ── */}
                <View style={styles.itemsContainer}>
                  {order.items?.map((item: any) => (
                    <View key={item._id} style={styles.orderItem}>
                      <Image source={{ uri: item.productId?.images?.[0] }} style={styles.itemImage} />
                      <View style={styles.itemInfo}>
                        <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{item.productId?.brand}</Text>
                        <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>{item.productId?.name}</Text>
                        {item.size ? <Text style={[styles.itemSize, { color: theme.colors.textTertiary }]}>Size: {item.size}</Text> : null}
                        <Text style={[styles.itemPrice, { color: theme.colors.textPrimary }]}>₹{item.price || item.productId?.price}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── Expanded Details ── */}
                {isExpanded && (
                  <View style={[styles.orderDetails, { borderTopColor: theme.colors.divider }]}>
                    <View style={styles.detailSection}>
                      <View style={styles.detailHeader}>
                        <MapPin size={18} color={theme.colors.primary} />
                        <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>Shipping Address</Text>
                      </View>
                      <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{order.shippingAddress}</Text>
                    </View>

                    <View style={styles.detailSection}>
                      <View style={styles.detailHeader}>
                        <CreditCard size={18} color={theme.colors.primary} />
                        <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>Payment</Text>
                      </View>
                      <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                        {order.paymentMethod || "Card"} · {order.paymentStatus || "Paid"}
                      </Text>
                    </View>

                    {order.tracking && (
                      <View style={styles.detailSection}>
                        <View style={styles.detailHeader}>
                          <Truck size={18} color={theme.colors.primary} />
                          <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>Tracking</Text>
                        </View>
                        <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                          {order.tracking.number} · {order.tracking.carrier}
                        </Text>
                        <View style={styles.timeline}>
                          {order.tracking.timeline?.map((event: any, index: number) => (
                            <View key={index} style={styles.timelineEvent}>
                              <View style={[styles.timelinePoint, { backgroundColor: theme.colors.primary }]} />
                              <View style={styles.timelineContent}>
                                <Text style={[styles.timelineStatus, { color: theme.colors.textPrimary }]}>{event.status}</Text>
                                <Text style={[styles.timelineLocation, { color: theme.colors.textSecondary }]}>{event.location}</Text>
                                <Text style={[styles.timelineTimestamp, { color: theme.colors.textTertiary }]}>
                                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : ""}
                                </Text>
                              </View>
                              {index !== order.tracking.timeline.length - 1 && (
                                <View style={[styles.timelineLine, { backgroundColor: theme.colors.divider }]} />
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* ── Action Buttons ── */}
                    <View style={styles.actionRow}>
                      {/* Invoice */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary }]}
                        onPress={() => handleDownloadInvoice(order)}
                        disabled={actionLoading === `${order._id}-invoice`}
                        activeOpacity={0.7}
                      >
                        {actionLoading === `${order._id}-invoice`
                          ? <ActivityIndicator size="small" color={theme.colors.primary} />
                          : <FileText size={15} color={theme.colors.primary} />}
                        <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Invoice</Text>
                      </TouchableOpacity>

                      {/* Reorder */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary }]}
                        onPress={() => handleReorder(order)}
                        disabled={actionLoading === `${order._id}-reorder`}
                        activeOpacity={0.7}
                      >
                        {actionLoading === `${order._id}-reorder`
                          ? <ActivityIndicator size="small" color={theme.colors.primary} />
                          : <RotateCcw size={15} color={theme.colors.primary} />}
                        <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Reorder</Text>
                      </TouchableOpacity>

                      {/* Cancel */}
                      {canCancel && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.colors.error + "40", backgroundColor: theme.isDark ? "#3A1B1F" : "#FFF5F5" }]}
                          onPress={() => handleCancelOrder(order)}
                          disabled={actionLoading === `${order._id}-cancel`}
                          activeOpacity={0.7}
                        >
                          {actionLoading === `${order._id}-cancel`
                            ? <ActivityIndicator size="small" color={theme.colors.error} />
                            : <XCircle size={15} color={theme.colors.error} />}
                          <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}

                      {/* Return */}
                      {canReturn && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.colors.warning + "60", backgroundColor: theme.isDark ? "#3A2E1A" : "#FFFBF0" }]}
                          onPress={() => handleReturnRequest(order)}
                          disabled={actionLoading === `${order._id}-return`}
                          activeOpacity={0.7}
                        >
                          {actionLoading === `${order._id}-return`
                            ? <ActivityIndicator size="small" color={theme.colors.warning} />
                            : <RefreshCcw size={15} color={theme.colors.warning} />}
                          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Return</Text>
                        </TouchableOpacity>
                      )}

                      {/* Already returned badge */}
                      {order.returnStatus === "Requested" && (
                        <View style={[styles.actionBtn, { borderColor: theme.colors.warning + "60", backgroundColor: theme.isDark ? "#3A2E1A" : "#FFFBF0" }]}>
                          <RefreshCcw size={15} color={theme.colors.warning} />
                          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Return Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* ── Footer ── */}
                <View style={[styles.orderFooter, { borderTopColor: theme.colors.divider }]}>
                  <View style={styles.totalContainer}>
                    <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Order Total</Text>
                    <Text style={[styles.totalAmount, { color: theme.colors.primary }]}>₹{order.total}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailsButton}
                    onPress={() => toggleOrderDetails(order._id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.detailsButtonText, { color: theme.colors.primary }]}>
                      {isExpanded ? "Hide Details" : "View Details"}
                    </Text>
                    <ChevronRight size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30, marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 16, marginBottom: 20 },
  loginButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  loginButtonText: { fontWeight: "bold", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  content: { flex: 1, padding: 12 },
  orderCard: { borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1 },
  orderId: { fontSize: 15, fontWeight: "bold" },
  orderDate: { fontSize: 12, marginTop: 2 },
  statusContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  orderStatus: { fontSize: 13, fontWeight: "600" },
  itemsContainer: { padding: 14 },
  orderItem: { flexDirection: "row", marginBottom: 10 },
  itemImage: { width: 70, height: 90, borderRadius: 6 },
  itemInfo: { flex: 1, marginLeft: 12, justifyContent: "center" },
  brandName: { fontSize: 12, marginBottom: 2 },
  itemName: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
  itemSize: { fontSize: 11, marginBottom: 2 },
  itemPrice: { fontSize: 15, fontWeight: "bold" },
  orderDetails: { padding: 14, borderTopWidth: 1 },
  detailSection: { marginBottom: 16 },
  detailHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  detailTitle: { fontSize: 15, fontWeight: "bold" },
  detailText: { fontSize: 13, lineHeight: 18 },
  timeline: { marginTop: 10 },
  timelineEvent: { flexDirection: "row", marginBottom: 16, position: "relative" },
  timelinePoint: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { position: "absolute", left: 4, top: 14, width: 2, height: "100%" },
  timelineContent: { marginLeft: 14, flex: 1 },
  timelineStatus: { fontSize: 13, fontWeight: "bold" },
  timelineLocation: { fontSize: 12 },
  timelineTimestamp: { fontSize: 11 },
  // ── Action buttons ──
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  orderFooter: { padding: 14, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  totalLabel: { fontSize: 14 },
  totalAmount: { fontSize: 16, fontWeight: "bold" },
  detailsButton: { flexDirection: "row", alignItems: "center" },
  detailsButtonText: { fontSize: 14, fontWeight: "600" },
});

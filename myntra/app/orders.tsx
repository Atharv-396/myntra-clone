import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
  CheckCircle,
} from "lucide-react-native";
import React from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ─── Professional Invoice HTML ────────────────────────────────────────────────
function buildInvoiceHtml(order: any): string {
  const invoiceNum = `INV-${order._id.slice(-8).toUpperCase()}`;
  const orderDate = new Date(order.date || order.createdAt).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });
  const printDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Recalculate totals from items for accuracy
  const itemsSubtotal = (order.items ?? []).reduce(
    (s: number, i: any) => s + ((i.price ?? i.productId?.price ?? 0) * (i.quantity ?? 1)),
    0
  );
  const tax = Math.round(itemsSubtotal * 0.18);
  const shipping = order.total > itemsSubtotal + tax ? order.total - itemsSubtotal - tax : 0;

  const itemRows = (order.items ?? [])
    .map((item: any) => {
      const name = item.productId?.name ?? "Product";
      const brand = item.productId?.brand ?? "";
      const price = item.price ?? item.productId?.price ?? 0;
      const qty = item.quantity ?? 1;
      const lineTotal = price * qty;
      return `
        <tr>
          <td class="product-cell">
            ${brand ? `<div class="brand">${brand}</div>` : ""}
            <div class="product-name">${name}</div>
            ${item.size ? `<div class="meta">Size: ${item.size}</div>` : ""}
            ${item.color && item.color !== "Default" ? `<div class="meta">Color: ${item.color}</div>` : ""}
          </td>
          <td class="center">${qty}</td>
          <td class="right">&#8377;${price.toLocaleString("en-IN")}</td>
          <td class="right bold">&#8377;${lineTotal.toLocaleString("en-IN")}</td>
        </tr>`;
    })
    .join("");

  const statusColor = order.status === "Delivered" ? "#16a34a"
    : order.status === "Cancelled" ? "#dc2626"
    : order.status === "Return Requested" ? "#d97706"
    : "#2563eb";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Invoice ${invoiceNum}</title>
<style>
  @page { margin: 20mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; line-height: 1.5; }

  /* ── Header ── */
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 0 20px; border-bottom: 3px solid #FF3F6C; margin-bottom: 28px; }
  .logo-block .logo { font-size: 32px; font-weight: 900; color: #FF3F6C; letter-spacing: 3px; line-height: 1; }
  .logo-block .tagline { font-size: 11px; color: #888; margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; }
  .invoice-block { text-align: right; }
  .invoice-block .invoice-title { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: 1px; }
  .invoice-block .invoice-num { font-size: 14px; font-weight: 600; color: #FF3F6C; margin-top: 4px; }
  .invoice-block .invoice-date { font-size: 12px; color: #888; margin-top: 3px; }

  /* ── Info Grid ── */
  .info-row { display: flex; gap: 20px; margin-bottom: 28px; }
  .info-card { flex: 1; background: #f8f9ff; border: 1px solid #e8eaf6; border-radius: 10px; padding: 14px 16px; }
  .info-card-title { font-size: 10px; font-weight: 800; color: #FF3F6C; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
  .info-card p { font-size: 12px; color: #444; line-height: 1.7; }
  .info-card .val { font-weight: 600; color: #1a1a2e; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40; }

  /* ── Table ── */
  .section-title { font-size: 12px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead { background: linear-gradient(135deg, #FF3F6C, #ff6b8a); color: #fff; }
  thead th { padding: 10px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  tbody tr { border-bottom: 1px solid #f0f0f0; transition: background 0.1s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:nth-child(even) { background: #fafbff; }
  tbody td { padding: 12px 14px; font-size: 12px; vertical-align: top; }
  .product-cell .brand { font-size: 10px; color: #FF3F6C; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .product-cell .product-name { font-size: 13px; font-weight: 600; color: #1a1a2e; }
  .product-cell .meta { font-size: 11px; color: #888; margin-top: 2px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }

  /* ── Totals ── */
  .totals-wrapper { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals-box { width: 280px; background: #f8f9ff; border: 1px solid #e8eaf6; border-radius: 10px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 13px; border-bottom: 1px solid #eee; }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand { background: #FF3F6C; color: #fff; font-size: 15px; font-weight: 800; }
  .totals-row .label { color: #555; }
  .totals-row.grand .label, .totals-row.grand .amount { color: #fff; }

  /* ── Footer ── */
  .page-footer { margin-top: 40px; padding-top: 16px; border-top: 1px dashed #ddd; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 18px; font-weight: 900; color: #FF3F6C; }
  .footer-note { font-size: 10px; color: #aaa; text-align: right; line-height: 1.6; }

  /* ── Print ── */
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<div class="page-header">
  <div class="logo-block">
    <div class="logo">MYNTRA</div>
    <div class="tagline">Fashion &amp; Lifestyle · myntra.com</div>
  </div>
  <div class="invoice-block">
    <div class="invoice-title">TAX INVOICE</div>
    <div class="invoice-num">${invoiceNum}</div>
    <div class="invoice-date">Issued: ${orderDate}</div>
    <div class="invoice-date" style="margin-top:6px"><span class="status-badge">${order.status}</span></div>
  </div>
</div>

<div class="info-row">
  <div class="info-card">
    <div class="info-card-title">📦 Shipping Address</div>
    <p>${(order.shippingAddress || "—").split(",").map((s: string) => `<span class="val">${s.trim()}</span>`).join("<br/>")}</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">💳 Payment Details</div>
    <p>Method: <span class="val">${order.paymentMethod || "—"}</span></p>
    <p>Status: <span class="val">${order.paymentStatus || "—"}</span></p>
    ${order.cashfreePaymentId ? `<p>Transaction: <span class="val" style="font-size:11px">${order.cashfreePaymentId}</span></p>` : ""}
  </div>
  <div class="info-card">
    <div class="info-card-title">🚚 Shipment</div>
    <p>Carrier: <span class="val">${order.tracking?.carrier || "—"}</span></p>
    <p>Tracking #: <span class="val">${order.tracking?.number || "—"}</span></p>
    <p>Est. Delivery: <span class="val">${order.tracking?.estimatedDelivery ? new Date(order.tracking.estimatedDelivery).toLocaleDateString("en-IN") : "—"}</span></p>
  </div>
</div>

<div class="section-title">Order Items</div>
<table>
  <thead>
    <tr>
      <th style="text-align:left">Product</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals-wrapper">
  <div class="totals-box">
    <div class="totals-row"><span class="label">Subtotal</span><span>&#8377;${itemsSubtotal.toLocaleString("en-IN")}</span></div>
    <div class="totals-row"><span class="label">Shipping</span><span>${shipping === 0 ? "FREE" : `&#8377;${shipping.toLocaleString("en-IN")}`}</span></div>
    <div class="totals-row"><span class="label">GST (18%)</span><span>&#8377;${tax.toLocaleString("en-IN")}</span></div>
    <div class="totals-row grand"><span class="label">Total Payable</span><span>&#8377;${(order.total ?? 0).toLocaleString("en-IN")}</span></div>
  </div>
</div>

<div class="page-footer">
  <div>
    <div class="footer-brand">MYNTRA</div>
    <div style="font-size:10px;color:#aaa;margin-top:2px">Printed on: ${printDate}</div>
  </div>
  <div class="footer-note">
    Thank you for shopping with Myntra!<br/>
    Support: support@myntra.com · This is a computer-generated invoice.
  </div>
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

  // Track per-order loading states independently
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [returnLoading, setReturnLoading] = useState<string | null>(null);

  // Stable user ref so async callbacks always have the latest user
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  const fetchOrders = async () => {
    const currentUser = userRef.current;
    if (!currentUser) { setIsLoading(false); setOrders([]); return; }
    try {
      setIsLoading(true);
      const res = await axios.get(`${BASE_URL}/order/user/${currentUser._id}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.log("fetchOrders error:", error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [user?._id]);

  // ── PDF Invoice ──────────────────────────────────────────────────────────────
  const handleDownloadInvoice = async (order: any) => {
    setInvoiceLoading(order._id);
    try {
      const html = buildInvoiceHtml(order);

      // On web: printAsync opens the browser's native print/save dialog
      // On native (iOS/Android): printToFileAsync → share sheet (save to Files, email, etc.)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // Native: generate PDF file then share
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
        });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Invoice INV-${order._id.slice(-8).toUpperCase()}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        // Web fallback: open HTML in new window and trigger browser print
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      console.log("Invoice error:", e);
      Alert.alert("Invoice Error", e?.message || "Could not generate invoice. Please try again.");
    } finally {
      setInvoiceLoading(null);
    }
  };

  // ── Reorder ──────────────────────────────────────────────────────────────────
  const handleReorder = async (order: any) => {
    const currentUser = userRef.current;
    if (!currentUser) { router.push("/login"); return; }

    setReorderLoading(order._id);
    try {
      const res = await axios.post(
        `${BASE_URL}/order/${order._id}/reorder`,
        { userId: currentUser._id },
        { timeout: 15000 }
      );
      const data = res.data;
      const addedCount = data.addedCount ?? 0;
      const skippedCount = data.skippedCount ?? 0;

      const msg = skippedCount > 0
        ? `${addedCount} item(s) added to your bag.\n${skippedCount} item(s) skipped (unavailable or out of stock).`
        : `${addedCount} item(s) added to your bag!`;

      Alert.alert(
        addedCount > 0 ? "Added to Bag ✓" : "Nothing Added",
        msg,
        addedCount > 0
          ? [
              { text: "View Bag", onPress: () => router.push("/(tabs)/bag") },
              { text: "Stay Here", style: "cancel" },
            ]
          : [{ text: "OK" }]
      );
    } catch (e: any) {
      console.log("Reorder error:", e?.response?.data, e?.message);
      Alert.alert(
        "Reorder Failed",
        e?.response?.data?.message || "Could not add items to bag. Please try again."
      );
    } finally {
      setReorderLoading(null);
    }
  };

  // ── Cancel Order ─────────────────────────────────────────────────────────────
  // NOTE: We do NOT call Alert inside the onPress of another Alert (nested Alert)
  // because on some Android versions nested Alerts are unreliable.
  // Instead we use a two-step approach: first Alert for confirmation, then do the work.
  const handleCancelOrder = (order: any) => {
    Alert.alert(
      "Cancel Order",
      `Cancel order #${order._id.slice(-8).toUpperCase()}?\n\nThis cannot be undone.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => executeCancelOrder(order._id),
        },
      ],
      { cancelable: true }
    );
  };

  const executeCancelOrder = async (orderId: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    setCancelLoading(orderId);
    try {
      await axios.post(
        `${BASE_URL}/order/${orderId}/cancel`,
        { userId: currentUser._id, reason: "Cancelled by customer" },
        { timeout: 15000 }
      );
      // Update local state immediately without refetch
      setOrders(prev =>
        prev.map(o => o._id === orderId ? { ...o, status: "Cancelled" } : o)
      );
      Alert.alert("Cancelled ✓", "Your order has been cancelled successfully.");
    } catch (e: any) {
      console.log("Cancel error:", e?.response?.data, e?.message);
      Alert.alert(
        "Cannot Cancel",
        e?.response?.data?.message || "Could not cancel order. Please try again."
      );
    } finally {
      setCancelLoading(null);
    }
  };

  // ── Return Request ────────────────────────────────────────────────────────────
  const handleReturnRequest = (order: any) => {
    Alert.alert(
      "Request Return",
      `Request a return for order #${order._id.slice(-8).toUpperCase()}?\n\nOur team will reach out within 24-48 hours.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Request Return",
          onPress: () => executeReturnRequest(order._id),
        },
      ],
      { cancelable: true }
    );
  };

  const executeReturnRequest = async (orderId: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    setReturnLoading(orderId);
    try {
      await axios.post(
        `${BASE_URL}/order/${orderId}/return`,
        { userId: currentUser._id, reason: "Return requested by customer" },
        { timeout: 15000 }
      );
      setOrders(prev =>
        prev.map(o => o._id === orderId ? { ...o, status: "Return Requested", returnStatus: "Requested" } : o)
      );
      Alert.alert("Return Submitted ✓", "Your return request has been submitted. We'll contact you within 24-48 hours.");
    } catch (e: any) {
      console.log("Return error:", e?.response?.data, e?.message);
      Alert.alert(
        "Return Failed",
        e?.response?.data?.message || "Could not submit return. Please try again."
      );
    } finally {
      setReturnLoading(null);
    }
  };

  // ── Status style helper ───────────────────────────────────────────────────────
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Delivered":        return { bg: theme.isDark ? "#1B3A26" : "#E6F4EA", color: theme.colors.success };
      case "Cancelled":        return { bg: theme.isDark ? "#3A1B1F" : "#FFEEF0", color: theme.colors.error };
      case "Return Requested": return { bg: theme.isDark ? "#3A2E1A" : "#FFF3CD", color: theme.colors.warning };
      case "Shipped":
      case "In Transit":
      case "Out for Delivery": return { bg: theme.isDark ? "#1A2E3A" : "#E3F2FD", color: "#2196F3" };
      default:                 return { bg: theme.isDark ? "#1B2E3A" : "#E3F2FD", color: theme.colors.info };
    }
  };

  const CANCELLABLE = ["Processing", "Packed"];
  const RETURNABLE  = ["Delivered"];

  // ── Render ────────────────────────────────────────────────────────────────────
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
          <Package size={56} color={theme.colors.textTertiary} />
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
            const canReturn = RETURNABLE.includes(order.status)
              && order.returnStatus !== "Requested"
              && order.returnStatus !== "Approved";
            const isReturnPending = order.returnStatus === "Requested";

            return (
              <View
                key={order._id}
                style={[styles.orderCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
              >
                {/* ── Header ── */}
                <TouchableOpacity
                  style={[styles.orderHeader, { borderBottomColor: theme.colors.divider }]}
                  onPress={() => toggleOrderDetails(order._id)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.orderId, { color: theme.colors.textPrimary }]}>
                      #{order._id.slice(-8).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDate, { color: theme.colors.textTertiary }]}>
                      {new Date(order.date || order.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Package size={12} color={statusStyle.color} />
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>{order.status}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>
                      ₹{order.total?.toLocaleString("en-IN")}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* ── Items preview ── */}
                <View style={styles.itemsContainer}>
                  {(order.items ?? []).slice(0, 3).map((item: any) => (
                    <View key={item._id} style={styles.orderItem}>
                      {item.productId?.images?.[0] ? (
                        <Image source={{ uri: item.productId.images[0] }} style={styles.itemImage} />
                      ) : (
                        <View style={[styles.itemImage, { backgroundColor: theme.colors.surfaceSecondary, justifyContent: "center", alignItems: "center" }]}>
                          <Package size={20} color={theme.colors.textTertiary} />
                        </View>
                      )}
                      <View style={styles.itemInfo}>
                        <Text style={[styles.brandName, { color: theme.colors.primary }]} numberOfLines={1}>
                          {item.productId?.brand}
                        </Text>
                        <Text style={[styles.itemName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                          {item.productId?.name}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                          {item.size ? (
                            <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>Size: {item.size}</Text>
                          ) : null}
                          <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                            Qty: {item.quantity ?? 1}
                          </Text>
                          <Text style={[styles.itemPrice, { color: theme.colors.textPrimary }]}>
                            ₹{(item.price ?? item.productId?.price ?? 0).toLocaleString("en-IN")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {(order.items?.length ?? 0) > 3 && (
                    <Text style={{ fontSize: 12, color: theme.colors.primary, marginTop: 4 }}>
                      +{order.items.length - 3} more item(s)
                    </Text>
                  )}
                </View>

                {/* ── Expanded details ── */}
                {isExpanded && (
                  <View style={[styles.detailsSection, { borderTopColor: theme.colors.divider }]}>
                    {/* Shipping */}
                    <View style={styles.detailRow}>
                      <MapPin size={16} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Shipping Address</Text>
                        <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>{order.shippingAddress}</Text>
                      </View>
                    </View>

                    {/* Payment */}
                    <View style={styles.detailRow}>
                      <CreditCard size={16} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Payment</Text>
                        <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>
                          {order.paymentMethod || "—"} · {order.paymentStatus || "—"}
                        </Text>
                      </View>
                    </View>

                    {/* Tracking */}
                    {order.tracking && (
                      <View style={styles.detailRow}>
                        <Truck size={16} color={theme.colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Tracking</Text>
                          <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>
                            {order.tracking.number} · {order.tracking.carrier}
                          </Text>
                          {order.tracking.timeline?.length > 0 && (
                            <View style={styles.timeline}>
                              {order.tracking.timeline.map((event: any, idx: number) => (
                                <View key={idx} style={styles.timelineRow}>
                                  <View style={[styles.timelineDot, { backgroundColor: idx === 0 ? theme.colors.primary : theme.colors.divider }]} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.timelineStatus, { color: theme.colors.textPrimary }]}>{event.status}</Text>
                                    <Text style={[styles.timelineMeta, { color: theme.colors.textTertiary }]}>
                                      {event.location}
                                      {event.timestamp ? ` · ${new Date(event.timestamp).toLocaleString()}` : ""}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* ── Action Buttons ── */}
                    <View style={styles.actionRow}>

                      {/* Invoice */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.primary + "60", backgroundColor: theme.isDark ? "#1E1E2E" : "#FFF7F9" }]}
                        onPress={() => handleDownloadInvoice(order)}
                        disabled={invoiceLoading === order._id}
                        activeOpacity={0.75}
                      >
                        {invoiceLoading === order._id
                          ? <ActivityIndicator size="small" color={theme.colors.primary} />
                          : <FileText size={15} color={theme.colors.primary} />}
                        <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Invoice</Text>
                      </TouchableOpacity>

                      {/* Reorder */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: theme.colors.primary + "60", backgroundColor: theme.isDark ? "#1E1E2E" : "#FFF7F9" }]}
                        onPress={() => handleReorder(order)}
                        disabled={reorderLoading === order._id}
                        activeOpacity={0.75}
                      >
                        {reorderLoading === order._id
                          ? <ActivityIndicator size="small" color={theme.colors.primary} />
                          : <RotateCcw size={15} color={theme.colors.primary} />}
                        <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Reorder</Text>
                      </TouchableOpacity>

                      {/* Cancel */}
                      {canCancel && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.colors.error + "50", backgroundColor: theme.isDark ? "#2A1515" : "#FFF5F5" }]}
                          onPress={() => handleCancelOrder(order)}
                          disabled={cancelLoading === order._id}
                          activeOpacity={0.75}
                        >
                          {cancelLoading === order._id
                            ? <ActivityIndicator size="small" color={theme.colors.error} />
                            : <XCircle size={15} color={theme.colors.error} />}
                          <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Cancel</Text>
                        </TouchableOpacity>
                      )}

                      {/* Return */}
                      {canReturn && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: theme.colors.warning + "60", backgroundColor: theme.isDark ? "#2A2000" : "#FFFBEE" }]}
                          onPress={() => handleReturnRequest(order)}
                          disabled={returnLoading === order._id}
                          activeOpacity={0.75}
                        >
                          {returnLoading === order._id
                            ? <ActivityIndicator size="small" color={theme.colors.warning} />
                            : <RefreshCcw size={15} color={theme.colors.warning} />}
                          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Return</Text>
                        </TouchableOpacity>
                      )}

                      {/* Return pending badge */}
                      {isReturnPending && (
                        <View style={[styles.actionBtn, { borderColor: theme.colors.warning + "60", backgroundColor: theme.isDark ? "#2A2000" : "#FFFBEE" }]}>
                          <CheckCircle size={15} color={theme.colors.warning} />
                          <Text style={[styles.actionBtnText, { color: theme.colors.warning }]}>Return Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* ── Footer ── */}
                <TouchableOpacity
                  style={[styles.orderFooter, { borderTopColor: theme.colors.divider }]}
                  onPress={() => toggleOrderDetails(order._id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewDetailsText, { color: theme.colors.primary }]}>
                    {isExpanded ? "Hide Details" : "View Details & Actions"}
                  </Text>
                  <ChevronRight
                    size={18}
                    color={theme.colors.primary}
                    style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
                  />
                </TouchableOpacity>
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
  errorText: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  loginButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8, marginTop: 12 },
  loginButtonText: { fontWeight: "bold", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  content: { flex: 1, padding: 12 },
  orderCard: { borderRadius: 12, marginBottom: 14, overflow: "hidden" },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1 },
  orderId: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  orderDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  itemsContainer: { paddingHorizontal: 14, paddingVertical: 10 },
  orderItem: { flexDirection: "row", marginBottom: 12, alignItems: "flex-start" },
  itemImage: { width: 64, height: 80, borderRadius: 8 },
  itemInfo: { flex: 1, marginLeft: 12 },
  brandName: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  itemName: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  metaText: { fontSize: 11 },
  itemPrice: { fontSize: 13, fontWeight: "700" },
  detailsSection: { padding: 14, borderTopWidth: 1, gap: 12 },
  detailRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  detailLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 13, lineHeight: 18 },
  timeline: { marginTop: 8, gap: 8 },
  timelineRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineStatus: { fontSize: 13, fontWeight: "600" },
  timelineMeta: { fontSize: 11 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    minWidth: 90,
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  viewDetailsText: { fontSize: 13, fontWeight: "600" },
});

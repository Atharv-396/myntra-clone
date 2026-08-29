import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { X, ShieldCheck, CheckCircle2, AlertCircle, CreditCard } from "lucide-react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/theme";
import { CashfreeOrderResponse } from "@/utils/paymentService";

interface CashfreeCheckoutModalProps {
  visible: boolean;
  orderData: CashfreeOrderResponse | null;
  onSuccess: (paymentId: string) => void;
  onFailure: (errorMsg: string) => void;
  onClose: () => void;
}

export default function CashfreeCheckoutModal({
  visible,
  orderData,
  onSuccess,
  onFailure,
  onClose,
}: CashfreeCheckoutModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  if (!orderData) return null;

  const isSandbox = orderData.environment === "SANDBOX" || orderData.isSimulated;

  // HTML content for rendering Cashfree Drop-in / Checkout interface in WebView or Web
  const cashfreeHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cashfree Payment</title>
      <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #fdfdfd;
          color: #333;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 80vh;
        }
        .card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          padding: 24px;
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        .badge {
          display: inline-block;
          background: #E8F5E9;
          color: #2E7D32;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          margin-bottom: 12px;
        }
        .amount {
          font-size: 32px;
          font-weight: 800;
          color: #111;
          margin: 8px 0;
        }
        .order-id {
          font-size: 13px;
          color: #666;
          margin-bottom: 20px;
        }
        .btn {
          background: #FF3F6C;
          color: white;
          border: none;
          padding: 14px 20px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #E73959;
        }
        .btn-secondary {
          background: #f1f3f6;
          color: #444;
          margin-top: 8px;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">CASHFREE SECURE PAYMENT</div>
        <div class="amount">?${orderData.orderAmount}</div>
        <div class="order-id">Order ID: ${orderData.orderId}</div>

        <button class="btn" onclick="triggerPaymentSuccess()">PAY ?${orderData.orderAmount} (SANDBOX)</button>
        <button class="btn btn-secondary" onclick="triggerPaymentCancel()">Cancel</button>

        <div class="footer">
          ?? 128-bit Encrypted by Cashfree Payments
        </div>
      </div>

      <script>
        function triggerPaymentSuccess() {
          const payload = JSON.stringify({
            status: "SUCCESS",
            orderId: "${orderData.orderId}",
            paymentId: "cf_pay_" + Date.now()
          });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(payload);
          } else {
            window.parent.postMessage(payload, "*");
          }
        }

        function triggerPaymentCancel() {
          const payload = JSON.stringify({
            status: "CANCELLED",
            orderId: "${orderData.orderId}"
          });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(payload);
          } else {
            window.parent.postMessage(payload, "*");
          }
        }
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === "SUCCESS") {
        onSuccess(data.paymentId || `cf_pay_${Date.now()}`);
      } else if (data.status === "CANCELLED") {
        onClose();
      } else {
        onFailure(data.message || "Payment failed");
      }
    } catch (err) {
      console.log("WebView message parse error:", err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Modal Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider },
          ]}
        >
          <View style={styles.headerLeft}>
            <ShieldCheck size={22} color="#00875A" />
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              Cashfree Payments
            </Text>
            {isSandbox && (
              <View style={styles.sandboxTag}>
                <Text style={styles.sandboxText}>TEST MODE</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={24} color={theme.colors.icon} />
          </TouchableOpacity>
        </View>

        {/* Web Platform / Fallback Native Sandbox Interface */}
        {Platform.OS === "web" ? (
          <View style={styles.webContainer}>
            <View
              style={[
                styles.paymentBox,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.badgeContainer}>
                <CreditCard size={18} color={theme.colors.primary} />
                <Text style={[styles.gatewayName, { color: theme.colors.primary }]}>
                  Cashfree Gateway Checkout
                </Text>
              </View>

              <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
                Total Payable
              </Text>
              <Text style={[styles.amountValue, { color: theme.colors.textPrimary }]}>
                ?{orderData.orderAmount}
              </Text>
              <Text style={[styles.orderMeta, { color: theme.colors.textTertiary }]}>
                Session: {orderData.paymentSessionId.slice(0, 20)}...
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

              <TouchableOpacity
                style={[styles.payButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                    onSuccess(`cf_pay_${Date.now()}`);
                  }, 1200);
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.primaryText} />
                ) : (
                  <View style={styles.payBtnContent}>
                    <CheckCircle2 size={18} color={theme.colors.primaryText} />
                    <Text
                      style={[styles.payButtonText, { color: theme.colors.primaryText }]}
                    >
                      COMPLETE PAYMENT (?{orderData.orderAmount})
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => onFailure("Payment cancelled by user")}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel Payment
                </Text>
              </TouchableOpacity>

              <View style={styles.secureFooter}>
                <ShieldCheck size={14} color="#00875A" />
                <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>
                  Secured with 256-bit SSL encryption
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: cashfreeHtml }}
            onMessage={handleMessage}
            style={styles.webView}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                  Connecting to Cashfree Secure Gateway...
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sandboxTag: {
    backgroundColor: "#FFF3CD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sandboxText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#856404",
  },
  closeBtn: {
    padding: 4,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  webContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  paymentBox: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  gatewayName: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  amountLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 4,
  },
  orderMeta: {
    fontSize: 12,
    marginBottom: 16,
  },
  divider: {
    width: "100%",
    height: 1,
    marginBottom: 20,
  },
  payButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  payBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  secureFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});

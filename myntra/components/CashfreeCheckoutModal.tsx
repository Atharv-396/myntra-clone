import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { X, ShieldCheck, CreditCard, AlertCircle, RefreshCw } from "lucide-react-native";
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

declare global {
  interface Window {
    Cashfree?: any;
  }
}

export default function CashfreeCheckoutModal({
  visible,
  orderData,
  onSuccess,
  onFailure,
  onClose,
}: CashfreeCheckoutModalProps) {
  const { theme } = useTheme();
  const [webSdkLoading, setWebSdkLoading] = useState(true);
  const [webSdkError, setWebSdkError] = useState<string | null>(null);
  const webSdkTriggered = useRef(false);

  const isSandbox =
    orderData?.environment === "SANDBOX" || orderData?.environment?.toLowerCase() === "sandbox";

  // Web Platform: Load and initialize Cashfree JS SDK v3
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !orderData) {
      webSdkTriggered.current = false;
      return;
    }

    let isMounted = true;

    const loadCashfreeSdk = async () => {
      setWebSdkLoading(true);
      setWebSdkError(null);

      // Helper to initialize Cashfree checkout
      const initCheckout = () => {
        if (!window.Cashfree) {
          if (isMounted) setWebSdkError("Cashfree SDK could not be loaded.");
          return;
        }

        try {
          const cashfree = window.Cashfree({
            mode: isSandbox ? "sandbox" : "production",
          });

          cashfree
            .checkout({
              paymentSessionId: orderData.paymentSessionId,
              redirectTarget: "_modal",
            })
            .then((result: any) => {
              if (result?.error) {
                console.log("[Cashfree Web SDK] Checkout error/dropped:", result.error);
                onFailure(result.error.message || "Payment cancelled or failed");
              } else if (result?.paymentDetails) {
                console.log("[Cashfree Web SDK] Checkout success:", result.paymentDetails);
                const paymentId =
                  result.paymentDetails.paymentId ||
                  result.paymentDetails.paymentMessage ||
                  `cf_pay_${Date.now()}`;
                onSuccess(paymentId);
              } else if (result?.redirect) {
                console.log("[Cashfree Web SDK] Redirection triggered");
              }
            })
            .catch((err: any) => {
              console.error("[Cashfree Web SDK] Checkout exception:", err);
              if (isMounted) {
                setWebSdkError(err?.message || "Cashfree checkout encounter an error.");
              }
            });
        } catch (e: any) {
          console.error("[Cashfree Web SDK] Init error:", e);
          if (isMounted) {
            setWebSdkError(e?.message || "Could not initialize Cashfree gateway.");
          }
        } finally {
          if (isMounted) setWebSdkLoading(false);
        }
      };

      if (window.Cashfree) {
        initCheckout();
        return;
      }

      // Dynamically load Cashfree JS SDK v3 script into DOM
      const existingScript = document.getElementById("cashfree-js-sdk");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cashfree-js-sdk";
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.async = true;
        script.onload = () => {
          if (isMounted) initCheckout();
        };
        script.onerror = () => {
          if (isMounted) {
            setWebSdkLoading(false);
            setWebSdkError("Failed to connect to Cashfree payment server. Check your network.");
          }
        };
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener("load", () => {
          if (isMounted) initCheckout();
        });
      }
    };

    if (!webSdkTriggered.current) {
      webSdkTriggered.current = true;
      loadCashfreeSdk();
    }

    return () => {
      isMounted = false;
    };
  }, [visible, orderData, isSandbox]);

  if (!orderData) return null;

  // HTML template for Mobile / Expo WebView with Cashfree JS SDK v3
  const nativeCheckoutHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Cashfree Secure Checkout</title>
      <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #f8f9fa;
          color: #212529;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 16px;
        }
        .loader-box {
          text-align: center;
          padding: 24px;
        }
        .spinner {
          width: 44px;
          height: 44px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #FF3F6C;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .loading-title { font-size: 16px; font-weight: 700; color: #282C3F; margin-bottom: 6px; }
        .loading-sub { font-size: 13px; color: #686B78; }
        #cashfree-dropin-container { width: 100%; max-width: 480px; min-height: 450px; }
      </style>
    </head>
    <body>
      <div id="loader" class="loader-box">
        <div class="spinner"></div>
        <div class="loading-title">Connecting to Cashfree Gateway</div>
        <div class="loading-sub">Securing session for ₹${orderData.orderAmount}...</div>
      </div>

      <div id="cashfree-dropin-container"></div>

      <script>
        function postToReactNative(data) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          }
        }

        window.onload = function() {
          try {
            if (!window.Cashfree) {
              postToReactNative({ status: "FAILED", message: "Cashfree SDK failed to initialize." });
              return;
            }

            var cashfree = window.Cashfree({
              mode: "${isSandbox ? "sandbox" : "production"}"
            });

            document.getElementById("loader").style.display = "none";

            cashfree.checkout({
              paymentSessionId: "${orderData.paymentSessionId}",
              redirectTarget: "_self"
            }).then(function(result) {
              if (result && result.error) {
                postToReactNative({
                  status: "FAILED",
                  message: result.error.message || "Payment cancelled or failed"
                });
              } else if (result && result.paymentDetails) {
                postToReactNative({
                  status: "SUCCESS",
                  paymentId: result.paymentDetails.paymentId || result.paymentDetails.paymentMessage || "cf_pay_success"
                });
              }
            }).catch(function(err) {
              postToReactNative({
                status: "FAILED",
                message: err ? (err.message || String(err)) : "Checkout encounter error"
              });
            });
          } catch(e) {
            postToReactNative({ status: "FAILED", message: e.message || "Error opening payment gateway" });
          }
        };
      </script>
    </body>
    </html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === "SUCCESS") {
        onSuccess(data.paymentId || `cf_pay_${Date.now()}`);
      } else if (data.status === "CANCELLED") {
        onClose();
      } else {
        onFailure(data.message || "Payment was not completed.");
      }
    } catch (err) {
      console.log("[Cashfree Modal] Message parse error:", err);
    }
  };

  const handleWebViewNavigationChange = (navState: any) => {
    const url = navState.url || "";
    // If Cashfree redirects to return_url containing order status or order_id
    if (url.includes("/orders") || url.includes("order_id=")) {
      // Payment completed and redirected to return URL
      onSuccess(`cf_pay_${Date.now()}`);
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

        {/* Web Platform Interface */}
        {Platform.OS === "web" ? (
          <View style={styles.webContainer}>
            <View
              style={[
                styles.paymentBox,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.badgeContainer}>
                <CreditCard size={20} color={theme.colors.primary} />
                <Text style={[styles.gatewayName, { color: theme.colors.primary }]}>
                  Cashfree Gateway Checkout
                </Text>
              </View>

              <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
                Total Amount Payable
              </Text>
              <Text style={[styles.amountValue, { color: theme.colors.textPrimary }]}>
                ₹{orderData.orderAmount}
              </Text>
              <Text style={[styles.orderMeta, { color: theme.colors.textTertiary }]}>
                Order: {orderData.orderId}
              </Text>

              {webSdkLoading && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                    Launching Cashfree Dropin Modal...
                  </Text>
                </View>
              )}

              {webSdkError && (
                <View style={styles.errorBox}>
                  <AlertCircle size={20} color={theme.colors.error} />
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {webSdkError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      webSdkTriggered.current = false;
                      setWebSdkError(null);
                    }}
                  >
                    <RefreshCw size={14} color="#FFF" />
                    <Text style={styles.retryBtnText}>Retry Gateway</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => {
                  onClose();
                  onFailure("Payment cancelled by user");
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel and Return to Bag
                </Text>
              </TouchableOpacity>

              <View style={styles.secureFooter}>
                <ShieldCheck size={14} color="#00875A" />
                <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>
                  Protected with 256-bit Bank-Grade Encryption
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Mobile Native WebView Platform */
          <WebView
            originWhitelist={["*"]}
            source={{ html: nativeCheckoutHtml }}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={handleWebViewNavigationChange}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
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
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  gatewayName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  loadingBox: {
    marginVertical: 20,
    alignItems: "center",
  },
  errorBox: {
    marginVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  retryBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  divider: {
    width: "100%",
    height: 1,
    marginVertical: 16,
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

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Package,
  ChevronRight,
  MapPin,
  Truck,
  CreditCard,
  ChevronLeft,
} from "lucide-react-native";
import React from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import BASE_URL from "@/config/api";
import { useTheme } from "@/theme";

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  useEffect(() => {
    const fetchorder = async () => {
      if (!user) {
        setIsLoading(false);
        setOrders([]);
        return;
      }
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
    fetchorder();
  }, [user?._id]);

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
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>My Orders</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            Please login to view your orders
          </Text>
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
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
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
          orders.map((order: any) => (
            <View
              key={order._id}
              style={[
                styles.orderCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
            >
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
                <View style={[styles.statusContainer, { backgroundColor: theme.isDark ? "#1B3A26" : "#E6F4EA" }]}>
                  <Package size={14} color={theme.colors.success} />
                  <Text style={[styles.orderStatus, { color: theme.colors.success }]}>{order.status}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.itemsContainer}>
                {order.items?.map((item: any) => (
                  <View key={item._id} style={styles.orderItem}>
                    <Image
                      source={{ uri: item.productId?.images?.[0] }}
                      style={styles.itemImage}
                    />
                    <View style={styles.itemInfo}>
                      <Text style={[styles.brandName, { color: theme.colors.textTertiary }]}>{item.productId?.brand}</Text>
                      <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>{item.productId?.name}</Text>
                      <Text style={[styles.itemPrice, { color: theme.colors.textPrimary }]}>₹{item.price || item.productId?.price}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {expandedOrder === order._id && (
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
                      <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>Payment Method</Text>
                    </View>
                    <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{order.paymentMethod || "Card"}</Text>
                  </View>

                  {order.tracking && (
                    <View style={styles.detailSection}>
                      <View style={styles.detailHeader}>
                        <Truck size={18} color={theme.colors.primary} />
                        <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>Tracking Information</Text>
                      </View>
                      <View style={styles.trackingInfo}>
                        <Text style={[styles.trackingNumber, { color: theme.colors.textSecondary }]}>
                          Tracking Number: {order.tracking.number}
                        </Text>
                        <Text style={[styles.trackingCarrier, { color: theme.colors.textSecondary }]}>
                          Carrier: {order.tracking.carrier}
                        </Text>
                      </View>

                      <View style={styles.timeline}>
                        {order.tracking.timeline?.map((event: any, index: any) => (
                          <View key={index} style={styles.timelineEvent}>
                            <View style={[styles.timelinePoint, { backgroundColor: theme.colors.primary }]} />
                            <View style={styles.timelineContent}>
                              <Text style={[styles.timelineStatus, { color: theme.colors.textPrimary }]}>
                                {event.status}
                              </Text>
                              <Text style={[styles.timelineLocation, { color: theme.colors.textSecondary }]}>
                                {event.location}
                              </Text>
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
                </View>
              )}

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
                    {expandedOrder === order._id ? "Hide Details" : "View Details"}
                  </Text>
                  <ChevronRight size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
  },
  loginButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 12,
  },
  orderCard: {
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
  },
  orderId: {
    fontSize: 15,
    fontWeight: "bold",
  },
  orderDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  orderStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemsContainer: {
    padding: 14,
  },
  orderItem: {
    flexDirection: "row",
    marginBottom: 10,
  },
  itemImage: {
    width: 70,
    height: 90,
    borderRadius: 6,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  brandName: {
    fontSize: 12,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "bold",
  },
  orderDetails: {
    padding: 14,
    borderTopWidth: 1,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "bold",
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
  },
  trackingInfo: {
    marginBottom: 12,
  },
  trackingNumber: {
    fontSize: 13,
    marginBottom: 2,
  },
  trackingCarrier: {
    fontSize: 13,
  },
  timeline: {
    marginTop: 10,
  },
  timelineEvent: {
    flexDirection: "row",
    marginBottom: 16,
    position: "relative",
  },
  timelinePoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 14,
    width: 2,
    height: "100%",
  },
  timelineContent: {
    marginLeft: 14,
    flex: 1,
  },
  timelineStatus: {
    fontSize: 13,
    fontWeight: "bold",
  },
  timelineLocation: {
    fontSize: 12,
  },
  timelineTimestamp: {
    fontSize: 11,
  },
  orderFooter: {
    padding: 14,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

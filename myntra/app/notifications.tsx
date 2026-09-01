import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Bell,
  BellOff,
  CheckCheck,
  Package,
  CreditCard,
  Truck,
  CircleCheck,
  TrendingDown,
  Sparkles,
  Megaphone,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications,
  markNotificationRead,
  markAllRead,
  NotificationItem,
} from "@/utils/notificationApi";
import { getNotificationRoute } from "@/utils/notificationService";
import { useTheme } from "@/theme";

const CATEGORY_ICONS: Record<string, any> = {
  ORDER:     Package,
  PAYMENT:   CreditCard,
  SHIPPING:  Truck,
  DELIVERY:  CircleCheck,
  WISHLIST:  TrendingDown,
  STOCK:     Sparkles,
  PROMOTION: Megaphone,
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchNotifications(user._id);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      console.log("Load notifications error:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleNotificationPress = async (notif: NotificationItem) => {
    if (!user) return;
    if (!notif.readAt) {
      markNotificationRead(user._id, notif._id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notif._id
            ? { ...n, readAt: new Date().toISOString(), status: "READ" }
            : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    const route = getNotificationRoute(notif.data || {});
    if (route) router.push(route as any);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllRead(user._id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        readAt: new Date().toISOString(),
        status: "READ",
      }))
    );
    setUnreadCount(0);
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notifications</Text>
        </View>
        <View style={styles.centerState}>
          <BellOff size={56} color={theme.colors.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Login to see your notifications</Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: theme.colors.primaryText }]}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notifications</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
            <CheckCheck size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Bell size={56} color={theme.colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Order updates, price drops and more will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
          }
        >
          {notifications.map((n) => {
            const isUnread = !n.readAt;
            const Icon = CATEGORY_ICONS[n.category] || Bell;
            return (
              <TouchableOpacity
                key={n._id}
                style={[
                  styles.card,
                  {
                    backgroundColor: isUnread
                      ? (theme.isDark ? "#252525" : "#FFF7F9")
                      : theme.colors.card,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleNotificationPress(n)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceSecondary }]}>
                  <Icon size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: theme.colors.textPrimary },
                        isUnread && { fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    {isUnread && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
                  </View>
                  <Text style={[styles.cardBody, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {n.body}
                  </Text>
                  <Text style={[styles.cardTime, { color: theme.colors.textTertiary }]}>
                    {new Date(n.sentAt || n.createdAt || Date.now()).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "bold" },
  markAllBtn: { padding: 4 },
  content: { flex: 1, padding: 12 },
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
  emptySubtitle: { fontSize: 13, textAlign: "center" },
  emptyText: { fontSize: 16, marginTop: 16, marginBottom: 20 },
  actionBtn: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  actionBtnText: { fontWeight: "bold", fontSize: 14 },
  card: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  cardTitle: { fontSize: 14, flex: 1, marginRight: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardBody: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
  cardTime: { fontSize: 11 },
});

import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Bell, BellOff, CheckCheck, ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications, markNotificationRead, markAllRead,
  fetchUnreadCount, NotificationItem,
} from "@/utils/notificationApi";
import { getNotificationRoute } from "@/utils/notificationService";

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getCategoryEmoji(type: string): string {
  if (type.startsWith("ORDER")) return "🛍️";
  if (type.startsWith("PAYMENT") || type.startsWith("REFUND")) return "💳";
  if (type.includes("SHIPPED") || type.includes("TRANSIT") || type.includes("PACKED")) return "🚚";
  if (type.includes("DELIVERY") || type.includes("DELIVERED") || type.includes("OUT_FOR")) return "📦";
  if (type.includes("PRICE_DROP")) return "🔥";
  if (type.includes("BACK_IN_STOCK")) return "🎉";
  if (type.includes("PROMO")) return "🏷️";
  return "🔔";
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1, append = false) => {
    if (!user) return;
    try {
      const data = await fetchNotifications(user._id, p, 20);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
      setNotifications((prev) => append ? [...prev, ...data.notifications] : data.notifications);
    } catch (e) {
      console.log("load notifications error:", e);
    }
  }, [user]);

  useEffect(() => {
    setIsLoading(true);
    load(1).finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await load(1);
    setRefreshing(false);
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || notifications.length >= total) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    await load(nextPage, true);
    setLoadingMore(false);
  };

  const handleTap = async (notif: NotificationItem) => {
    if (!user) return;
    // Mark as read
    if (!notif.readAt) {
      markNotificationRead(user._id, notif._id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => n._id === notif._id ? { ...n, readAt: new Date().toISOString(), status: "READ" } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    // Navigate
    const route = getNotificationRoute(notif.data);
    if (route) router.push(route as any);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllRead(user._id).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString(), status: "READ" })));
    setUnreadCount(0);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#3e3e3e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.centerState}>
          <BellOff size={56} color="#ccc" />
          <Text style={styles.emptyText}>Login to see your notifications</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/login")}>
            <Text style={styles.actionBtnText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#3e3e3e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#ff3f6c" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#3e3e3e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <CheckCheck size={20} color="#ff3f6c" />
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Bell size={56} color="#ccc" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>Order updates, price drops and more will appear here</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#ff3f6c"]} />}
          onScrollEndDrag={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {notifications.map((notif) => (
            <TouchableOpacity
              key={notif._id}
              style={[styles.item, !notif.readAt && styles.unreadItem]}
              onPress={() => handleTap(notif)}
              activeOpacity={0.8}
            >
              <View style={styles.itemLeft}>
                <Text style={styles.emoji}>{getCategoryEmoji(notif.type)}</Text>
                {!notif.readAt && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, !notif.readAt && styles.boldTitle]}>
                  {notif.title}
                </Text>
                <Text style={styles.itemBody2} numberOfLines={2}>{notif.body}</Text>
                <Text style={styles.itemTime}>{formatTime(notif.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {loadingMore && <ActivityIndicator size="small" color="#ff3f6c" style={{ padding: 16 }} />}
          {notifications.length >= total && notifications.length > 0 && (
            <Text style={styles.endText}>You're all caught up</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", padding: 15, paddingTop: 50, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "bold", color: "#3e3e3e" },
  markAllBtn: { padding: 6 },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#3e3e3e", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  emptyText: { fontSize: 16, color: "#666", marginTop: 16, marginBottom: 20 },
  actionBtn: { backgroundColor: "#ff3f6c", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  list: { flex: 1 },
  item: { flexDirection: "row", padding: 15, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", backgroundColor: "#fff" },
  unreadItem: { backgroundColor: "#fff8f8" },
  itemLeft: { width: 44, alignItems: "center", paddingTop: 2 },
  emoji: { fontSize: 22 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3f6c", marginTop: 4 },
  itemBody: { flex: 1, paddingLeft: 4 },
  itemTitle: { fontSize: 14, color: "#3e3e3e", marginBottom: 3 },
  boldTitle: { fontWeight: "bold" },
  itemBody2: { fontSize: 13, color: "#666", marginBottom: 4, lineHeight: 18 },
  itemTime: { fontSize: 11, color: "#aaa" },
  endText: { textAlign: "center", color: "#aaa", fontSize: 13, padding: 20 },
});

/**
 * notificationService.ts (frontend)
 * Handles all push notification setup for the Expo app:
 * - Permission request
 * - Expo Push Token generation
 * - Device registration with backend
 * - Notification listeners
 * - Navigation on tap
 *
 * IMPORTANT: The Expo access token is NEVER present here.
 * It lives exclusively in the backend .env.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import axios from "axios";
import BASE_URL from "@/config/api";

// ── Configure foreground notification behavior ───────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android notification channels ────────────────────────────────────────────
export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;
  await Promise.all([
    Notifications.setNotificationChannelAsync("order", {
      name: "Orders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("payment", {
      name: "Payments",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("shipping", {
      name: "Shipping",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("delivery", {
      name: "Delivery",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("wishlist", {
      name: "Wishlist",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("stock", {
      name: "Stock Alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("promotion", {
      name: "Promotions",
      importance: Notifications.AndroidImportance.LOW,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("cart", {
      name: "Cart Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#ff3f6c",
    }),
    Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ]);
}

/**
 * Request notification permissions and get the Expo Push Token.
 * Returns the token string or null if unavailable/denied.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log("[Notifications] Push notifications require a physical device");
      return null;
    }

    // Expo Go does not support remote push notifications from SDK 53+
    // Skip silently to avoid the warning — use a development build for real push notifications
    const isExpoGo = Constants.appOwnership === "expo";
    if (isExpoGo) {
      console.log("[Notifications] Expo Go detected — skipping push registration. Use a dev build for real notifications.");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission denied");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log("[Notifications] No EAS projectId found in app.json");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err: any) {
    console.log("[Notifications] getExpoPushToken error:", err.message);
    return null;
  }
}

/**
 * Register this device's push token with the backend.
 * Called after login. Never sends userId from this function — caller passes it.
 */
export async function registerDeviceToken(userId: string, token: string): Promise<void> {
  try {
    const deviceId = Constants.sessionId || `device_${userId}`;
    const platform = Platform.OS as "android" | "ios" | "web";
    const appVersion = Constants.expoConfig?.version || "1.0.0";

    await axios.post(`${BASE_URL}/api/notifications/devices`, {
      userId,
      expoPushToken: token,
      deviceId,
      platform,
      appVersion,
    });

    console.log("[Notifications] Device registered");
  } catch (err: any) {
    console.log("[Notifications] registerDeviceToken error:", err.message);
    // Never throw — notification failure must not break login
  }
}

/**
 * Deregister this device when the user logs out.
 */
export async function deregisterDevice(userId: string): Promise<void> {
  try {
    const deviceId = Constants.sessionId || `device_${userId}`;
    await axios.delete(`${BASE_URL}/api/notifications/devices/${deviceId}`, {
      data: { userId },
    });
    console.log("[Notifications] Device deregistered");
  } catch (err: any) {
    console.log("[Notifications] deregisterDevice error:", err.message);
  }
}

/**
 * Full initialization — call this after successful login.
 * Sets up channels, gets token, registers with backend.
 */
export async function initializeNotifications(userId: string): Promise<void> {
  try {
    await setupAndroidChannels();
    const token = await getExpoPushToken();
    if (token) {
      await registerDeviceToken(userId, token);
    }
  } catch (err: any) {
    console.log("[Notifications] initializeNotifications error:", err.message);
  }
}

/**
 * Navigate to the correct screen based on notification data.
 * Returns the route path or null if no navigation needed.
 */
export function getNotificationRoute(data: Record<string, any>): string | null {
  if (!data?.type) return null;

  switch (data.type) {
    case "ORDER_CONFIRMED":
    case "ORDER_CANCELLED":
    case "ORDER_RETURNED":
    case "PAYMENT_SUCCESS":
    case "PAYMENT_FAILED":
    case "REFUND_INITIATED":
    case "REFUND_COMPLETED":
    case "ORDER_DELIVERED":
    case "DELIVERY_FAILED":
      return "/orders";

    case "ORDER_PACKED":
    case "ORDER_SHIPPED":
    case "ORDER_IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "/orders";

    case "WISHLIST_PRICE_DROP":
      return data.productId ? `/product/${data.productId}` : "/wishlist";

    case "PRODUCT_BACK_IN_STOCK":
    case "VARIANT_BACK_IN_STOCK":
      return data.productId ? `/product/${data.productId}` : "/";

    case "PROMOTIONAL_CAMPAIGN":
      return "/";

    case "CART_ABANDONED":
      return "/bag";

    default:
      return null;
  }
}

export interface NotificationItem {
  _id: string;
  userId: string;
  category: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  readAt?: string;
  sentAt?: string;
  status?: string;
  createdAt?: string;
}

export interface FetchNotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export async function fetchNotifications(userId: string): Promise<FetchNotificationsResponse> {
  try {
    const res = await axios.get(`${BASE_URL}/api/notifications/${userId}`);
    if (res.data && Array.isArray(res.data.notifications)) {
      return res.data;
    }
    const items = Array.isArray(res.data) ? res.data : [];
    const unread = items.filter((n: any) => !n.readAt && n.status !== "READ").length;
    return { notifications: items, unreadCount: unread };
  } catch (err: any) {
    console.log("[Notifications] fetchNotifications error:", err.message);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await axios.patch(`${BASE_URL}/api/notifications/${id}/read`);
  } catch (err: any) {
    console.log("[Notifications] markNotificationRead error:", err.message);
  }
}

export async function markAllRead(userId: string): Promise<void> {
  try {
    await axios.patch(`${BASE_URL}/api/notifications/read-all/${userId}`);
  } catch (err: any) {
    console.log("[Notifications] markAllRead error:", err.message);
  }
}


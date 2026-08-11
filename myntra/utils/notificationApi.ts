/**
 * notificationApi.ts
 * Frontend API calls for notification history and preferences.
 */

import axios from "axios";
import BASE_URL from "@/config/api";

export interface NotificationItem {
  _id: string;
  userId: string;
  category: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  status: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPrefs {
  orderNotifications: boolean;
  paymentNotifications: boolean;
  shippingNotifications: boolean;
  deliveryNotifications: boolean;
  wishlistNotifications: boolean;
  stockNotifications: boolean;
  promotionNotifications: boolean;
  cartNotifications: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  orderNotifications: true,
  paymentNotifications: true,
  shippingNotifications: true,
  deliveryNotifications: true,
  wishlistNotifications: true,
  stockNotifications: true,
  promotionNotifications: true,
  cartNotifications: true,
};

function normalizePrefs(raw: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const out: NotificationPrefs = { ...DEFAULT_PREFS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) {
      if (typeof raw[k] === "boolean") {
        out[k] = raw[k] as boolean;
      }
    }
  }
  return out;
}

export const fetchNotifications = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<{ notifications: NotificationItem[]; total: number; unreadCount: number }> => {
  const res = await axios.get(`${BASE_URL}/api/notifications`, {
    params: { userId, page, limit },
  });
  return res.data;
};

export const fetchUnreadCount = async (userId: string): Promise<number> => {
  try {
    const res = await axios.get(`${BASE_URL}/api/notifications/unread-count`, {
      params: { userId },
    });
    return res.data.unreadCount || 0;
  } catch {
    return 0;
  }
};

export const markNotificationRead = async (userId: string, notifId: string): Promise<void> => {
  await axios.patch(`${BASE_URL}/api/notifications/${notifId}/read`, { userId });
};

export const markAllRead = async (userId: string): Promise<void> => {
  await axios.patch(`${BASE_URL}/api/notifications/read-all`, { userId });
};

export const fetchPreferences = async (userId: string): Promise<NotificationPrefs> => {
  const res = await axios.get(`${BASE_URL}/api/notifications/preferences`, {
    params: { userId },
  });
  return normalizePrefs(res.data);
};

export const updatePreferences = async (
  userId: string,
  updates: Partial<NotificationPrefs>
): Promise<NotificationPrefs> => {
  const res = await axios.patch(`${BASE_URL}/api/notifications/preferences`, {
    userId,
    ...updates,
  });
  return normalizePrefs(res.data);
};

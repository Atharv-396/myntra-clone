import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Switch, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { fetchPreferences, updatePreferences, NotificationPrefs } from "@/utils/notificationApi";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

type PrefKey = keyof NotificationPrefs;

const SETTINGS: { key: PrefKey; label: string; description: string }[] = [
  { key: "orderNotifications",    label: "Orders",              description: "Order confirmations and updates" },
  { key: "paymentNotifications",  label: "Payments",            description: "Payment and refund updates" },
  { key: "shippingNotifications", label: "Shipping",            description: "Shipping progress updates" },
  { key: "deliveryNotifications", label: "Delivery",            description: "Delivery status updates" },
  { key: "wishlistNotifications", label: "Wishlist",            description: "Wishlist price-drop alerts" },
  { key: "stockNotifications",    label: "Back in Stock",       description: "Product availability alerts" },
  { key: "promotionNotifications",label: "Promotions",          description: "Sales and promotional campaigns" },
  { key: "cartNotifications",     label: "Cart Reminders",      description: "Abandoned cart reminders and bag nudges" },
];

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { headerPaddingTop } = useResponsive();

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<PrefKey | null>(null);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchPreferences(user._id);
      setPrefs(data);
    } catch (e) {
      console.log("loadPrefs error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const handleToggle = async (key: PrefKey, newValue: boolean) => {
    if (!user || !prefs || updating) return;

    const prevValue = prefs[key];
    setPrefs((p) => p ? { ...p, [key]: newValue } : p);
    setUpdating(key);

    try {
      const updated = await updatePreferences(user._id, { [key]: newValue });
      setPrefs(updated);
    } catch (e) {
      setPrefs((p) => p ? { ...p, [key]: prevValue } : p);
      Alert.alert("Failed to update", "Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider, paddingTop: headerPaddingTop }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color={theme.colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notification Settings</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={[styles.loginText, { color: theme.colors.textSecondary }]}>Login to manage notification settings</Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.loginBtnText, { color: theme.colors.primaryText }]}>LOGIN</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notification Settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={[styles.sectionNote, { color: theme.colors.textSecondary }]}>
            Choose which notifications you want to receive on this device.
          </Text>

          <View
            style={[
              styles.settingsCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderWidth: 1,
              },
            ]}
          >
            {SETTINGS.map((setting, index) => (
              <View
                key={setting.key}
                style={[
                  styles.row,
                  index < SETTINGS.length - 1 && [styles.rowBorder, { borderBottomColor: theme.colors.divider }],
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>{setting.label}</Text>
                  <Text style={[styles.rowDesc, { color: theme.colors.textTertiary }]}>{setting.description}</Text>
                </View>
                <Switch
                  value={prefs ? prefs[setting.key] : true}
                  onValueChange={(val) => handleToggle(setting.key, val)}
                  disabled={updating === setting.key}
                  trackColor={{
                    false: theme.isDark ? "#3A3A3A" : "#E0E0E0",
                    true: theme.isDark ? "#8A243D" : "#FFB3C6",
                  }}
                  thumbColor={prefs?.[setting.key] ? theme.colors.primary : "#FFF"}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.footerNote, { color: theme.colors.textTertiary }]}>
            You can always change these settings later. Some critical notifications
            like order confirmations may still be sent per our policy.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "bold" },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30, marginTop: 80 },
  loginText: { fontSize: 16, marginBottom: 20 },
  loginBtn: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { fontWeight: "bold", fontSize: 15 },
  content: { flex: 1, padding: 14 },
  sectionNote: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  settingsCard: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1 },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  rowDesc: { fontSize: 12 },
  footerNote: { fontSize: 12, marginTop: 20, marginBottom: 40, lineHeight: 18, textAlign: "center" },
});

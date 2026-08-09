import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Switch, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { fetchPreferences, updatePreferences, NotificationPrefs } from "@/utils/notificationApi";

type PrefKey = keyof NotificationPrefs;

const SETTINGS: { key: PrefKey; label: string; description: string }[] = [
  { key: "orderNotifications",    label: "Orders",       description: "Order confirmations and updates" },
  { key: "paymentNotifications",  label: "Payments",     description: "Payment and refund updates" },
  { key: "shippingNotifications", label: "Shipping",     description: "Shipping progress updates" },
  { key: "deliveryNotifications", label: "Delivery",     description: "Delivery status updates" },
  { key: "wishlistNotifications", label: "Wishlist",     description: "Wishlist price-drop alerts" },
  { key: "stockNotifications",    label: "Back in Stock",description: "Product availability alerts" },
  { key: "promotionNotifications",label: "Promotions",   description: "Sales and promotional campaigns" },
];

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();

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

    // Optimistic update
    const prevValue = prefs[key];
    setPrefs((p) => p ? { ...p, [key]: newValue } : p);
    setUpdating(key);

    try {
      const updated = await updatePreferences(user._id, { [key]: newValue });
      setPrefs(updated);
    } catch (e) {
      // Revert on failure
      setPrefs((p) => p ? { ...p, [key]: prevValue } : p);
      Alert.alert("Failed to update", "Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#3e3e3e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Settings</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.loginText}>Login to manage notification settings</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
            <Text style={styles.loginBtnText}>LOGIN</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#ff3f6c" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionNote}>
            Choose which notifications you want to receive on this device.
          </Text>

          <View style={styles.settingsCard}>
            {SETTINGS.map((setting, index) => (
              <View
                key={setting.key}
                style={[
                  styles.row,
                  index < SETTINGS.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>{setting.label}</Text>
                  <Text style={styles.rowDesc}>{setting.description}</Text>
                </View>
                <Switch
                  value={prefs ? prefs[setting.key] : true}
                  onValueChange={(val) => handleToggle(setting.key, val)}
                  disabled={updating === setting.key}
                  trackColor={{ false: "#e0e0e0", true: "#ffb3c6" }}
                  thumbColor={prefs?.[setting.key] ? "#ff3f6c" : "#fff"}
                />
              </View>
            ))}
          </View>

          <Text style={styles.footerNote}>
            You can always change these settings later. Some critical notifications
            like order confirmations may still be sent per our policy.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { flexDirection: "row", alignItems: "center", padding: 15, paddingTop: 50, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "bold", color: "#3e3e3e" },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  loginText: { fontSize: 16, color: "#666", marginBottom: 20 },
  loginBtn: { backgroundColor: "#ff3f6c", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  content: { flex: 1, padding: 15 },
  sectionNote: { fontSize: 14, color: "#888", marginBottom: 15, lineHeight: 20 },
  settingsCard: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#3e3e3e", marginBottom: 2 },
  rowDesc: { fontSize: 13, color: "#888" },
  footerNote: { fontSize: 12, color: "#aaa", marginTop: 20, marginBottom: 40, lineHeight: 18, textAlign: "center" },
});

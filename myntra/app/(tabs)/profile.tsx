import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Package,
  Heart,
  Settings,
  LogOut,
  ChevronRight,
  Clock,
  Bell,
  Sun,
  Moon,
  Smartphone,
  Check,
} from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/theme";

const menuItems = [
  { icon: Package, label: "Orders", route: "/orders" },
  { icon: Heart, label: "Wishlist", route: "/wishlist" },
  { icon: Bell, label: "Notifications", route: "/notifications" },
  { icon: Clock, label: "Recently Viewed", route: "/recently-viewed" },
  { icon: Settings, label: "Notification Settings", route: "/notification-settings" },
];

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  sublabel: string;
  icon: typeof Sun;
}[] = [
  {
    mode: "system",
    label: "System Default",
    sublabel: "Match device setting",
    icon: Smartphone,
  },
  {
    mode: "light",
    label: "Light Mode",
    sublabel: "Clean & bright",
    icon: Sun,
  },
  {
    mode: "dark",
    label: "Dark Mode",
    sublabel: "Easy on the eyes",
    icon: Moon,
  },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode, systemTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.divider }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* User Card */}
        {user ? (
          <View style={[styles.userInfo, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <User size={40} color={theme.colors.primaryText} />
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: theme.colors.textPrimary }]}>{user.name}</Text>
              <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.guestCard, { backgroundColor: theme.colors.card }]}>
            <User size={48} color={theme.colors.primary} />
            <Text style={[styles.guestTitle, { color: theme.colors.textPrimary }]}>
              Welcome to Myntra
            </Text>
            <Text style={[styles.guestSubtitle, { color: theme.colors.textSecondary }]}>
              Login to view orders, saved items and synced settings
            </Text>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push("/login")}
            >
              <Text style={[styles.loginButtonText, { color: theme.colors.primaryText }]}>LOGIN / SIGNUP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Appearance / Theme Selector */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>APPEARANCE</Text>
        </View>
        <View style={[styles.cardGroup, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {THEME_OPTIONS.map((opt, index) => {
            const isSelected = themeMode === opt.mode;
            const Icon = opt.icon;
            const subtext =
              opt.mode === "system"
                ? `System (${systemTheme === "dark" ? "Dark" : "Light"})`
                : opt.sublabel;

            return (
              <TouchableOpacity
                key={opt.mode}
                style={[
                  styles.themeOptionRow,
                  index < THEME_OPTIONS.length - 1 && [styles.rowBorder, { borderBottomColor: theme.colors.divider }],
                  isSelected && { backgroundColor: theme.isDark ? "#252525" : "#FFF7F9" },
                ]}
                onPress={() => setThemeMode(opt.mode)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSecondary }]}>
                  <Icon size={18} color={isSelected ? "#FFF" : theme.colors.icon} />
                </View>
                <View style={styles.themeTextContainer}>
                  <Text style={[styles.themeOptionLabel, { color: theme.colors.textPrimary }, isSelected && { fontWeight: "700" }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.themeOptionSub, { color: theme.colors.textTertiary }]}>
                    {subtext}
                  </Text>
                </View>
                {isSelected ? (
                  <View style={[styles.checkCircle, { backgroundColor: theme.colors.primary }]}>
                    <Check size={14} color="#FFF" />
                  </View>
                ) : (
                  <View style={[styles.radioOutline, { borderColor: theme.colors.border }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Menu Section */}
        {user && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ACCOUNT & SETTINGS</Text>
            </View>
            <View style={[styles.cardGroup, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index < menuItems.length - 1 && [styles.rowBorder, { borderBottomColor: theme.colors.divider }],
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <item.icon size={22} color={theme.colors.icon} />
                    <Text style={[styles.menuItemLabel, { color: theme.colors.textPrimary }]}>{item.label}</Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.logoutButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.card }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={20} color={theme.colors.primary} />
              <Text style={[styles.logoutText, { color: theme.colors.primary }]}>Logout</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginBottom: 10,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
  },
  guestCard: {
    padding: 24,
    alignItems: "center",
    marginBottom: 10,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
  },
  guestSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  loginButton: {
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardGroup: {
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  themeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  themeTextContainer: {
    flex: 1,
  },
  themeOptionLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  themeOptionSub: {
    fontSize: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 14,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    marginVertical: 20,
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "bold",
  },
});

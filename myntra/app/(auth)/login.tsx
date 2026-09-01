import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import React from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";

export default function Login() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const { width, isTablet } = useResponsive();
  // Background image height and form overlap adapt to screen size
  const bgImageHeight = isTablet ? 400 : Math.min(300, width * 0.7);
  const formMarginTop = bgImageHeight - 60;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isloading, setisloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMsg("Please enter email and password");
      return;
    }
    try {
      setErrorMsg("");
      setisloading(true);
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Login failed. Please try again.";
      setErrorMsg(msg);
    } finally {
      setisloading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop",
        }}
        style={[styles.backgroundImage, { height: bgImageHeight }]}
      />
      <View
        style={[
          styles.formContainer,
          {
            backgroundColor: theme.isDark ? "#1E1E1E" : "rgba(255, 255, 255, 0.95)",
            borderColor: theme.colors.border,
            borderWidth: 1,
            marginTop: formMarginTop,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Welcome to Myntra</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Login to continue shopping</Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surfaceSecondary,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={theme.colors.placeholder}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setErrorMsg("");
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View
          style={[
            styles.passwordContainer,
            {
              backgroundColor: theme.colors.surfaceSecondary,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.passwordInput,
              { color: theme.colors.textPrimary },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.colors.placeholder}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrorMsg("");
            }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff size={20} color={theme.colors.iconSecondary} />
            ) : (
              <Eye size={20} color={theme.colors.iconSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMsg}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleLogin}
          disabled={isloading}
          activeOpacity={0.85}
        >
          {isloading ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.primaryText }]}>LOGIN</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signupLink}
          onPress={() => router.push("/signup")}
          activeOpacity={0.7}
        >
          <Text style={[styles.signupText, { color: theme.colors.primary }]}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundImage: {
    width: "100%",
    position: "absolute",
    top: 0,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 26,
  },
  input: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
  },
  eyeIcon: {
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "bold",
  },
  signupLink: {
    marginTop: 20,
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

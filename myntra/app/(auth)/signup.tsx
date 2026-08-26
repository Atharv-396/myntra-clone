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
import { Eye, EyeOff } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/theme";

export default function Signup() {
  const { Signup } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [isloading, setisloading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      fullName: "",
      email: "",
      password: "",
    };

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
      isValid = false;
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (validateForm()) {
      try {
        setisloading(true);
        await Signup(formData.fullName, formData.email, formData.password);
        router.replace("/(tabs)");
      } catch (error) {
        console.error(error);
      } finally {
        setisloading(false);
      }
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Image
        source={{
          uri: "https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
        }}
        style={styles.backgroundImage}
      />

      <View
        style={[
          styles.formContainer,
          {
            backgroundColor: theme.isDark ? "#1E1E1E" : "rgba(255, 255, 255, 0.95)",
            borderColor: theme.colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Join Myntra and discover amazing fashion
        </Text>

        <View style={styles.inputGroup}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                borderColor: errors.fullName ? theme.colors.error : theme.colors.border,
              },
            ]}
            placeholder="Full Name"
            placeholderTextColor={theme.colors.placeholder}
            value={formData.fullName}
            onChangeText={(text) =>
              setFormData({ ...formData, fullName: text })
            }
          />
          {errors.fullName ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.fullName}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                borderColor: errors.email ? theme.colors.error : theme.colors.border,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={theme.colors.placeholder}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.email}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <View
            style={[
              styles.passwordContainer,
              {
                backgroundColor: theme.colors.surfaceSecondary,
                borderColor: errors.password ? theme.colors.error : theme.colors.border,
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
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
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
          {errors.password ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.password}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleSignup}
          disabled={isloading}
          activeOpacity={0.85}
        >
          {isloading ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.primaryText }]}>SIGN UP</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.push("/login")}
          activeOpacity={0.7}
        >
          <Text style={[styles.loginText, { color: theme.colors.primary }]}>
            Already have an account? Login
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
    height: 300,
    position: "absolute",
    top: 0,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    marginTop: 240,
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
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
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
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "bold",
  },
  loginLink: {
    marginTop: 18,
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

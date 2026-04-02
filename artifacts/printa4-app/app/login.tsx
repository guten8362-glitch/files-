import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, bypassLogin } = useApp();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const success = await login(email.trim(), password);
      if (success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.replace("/(tabs)/tasks");
      } else {
        setError("Invalid credentials. Please check your email and password.");
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = async () => {
    setLoading(true);
    try {
      await bypassLogin();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      router.replace("/(tabs)/tasks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Feather name="printer" size={32} color={Colors.white} />
            </View>
            <View style={styles.wrenchBadge}>
              <Feather name="tool" size={12} color={Colors.white} />
            </View>
          </View>

          <Text style={styles.appName}>Print-Tech Flow</Text>
          <Text style={styles.appSubtitle}>Maintenance Portal</Text>
          <View style={styles.divider} />
          <Text style={styles.welcomeText}>Welcome back, Technician</Text>
          <Text style={styles.subText}>Sign in to access your maintenance tasks</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your.name@college.edu"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={16} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.textTertiary} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <Feather name="arrow-right" size={18} color={Colors.white} />
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.bypassBtn, pressed && { backgroundColor: Colors.borderLight }]}
            onPress={handleBypass}
          >
            <Text style={styles.bypassBtnText}>Bypass Login (Guest Mode)</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.secureRow}>
            <Feather name="shield" size={12} color={Colors.textTertiary} />
            <Text style={styles.footerText}>Secured College Network</Text>
          </View>
          <Text style={styles.footerSub}>IT Department — Print-Tech System v2.1</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 32,
  },
  topSection: {
    alignItems: "center",
    gap: 8,
    paddingTop: 20,
  },
  logoContainer: {
    position: "relative",
    marginBottom: 8,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  wrenchBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginVertical: 8,
  },
  welcomeText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.priorityHighBg,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
    flex: 1,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 14,
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  bypassBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 4,
  },
  bypassBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  demoText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingBottom: 8,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  footerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});

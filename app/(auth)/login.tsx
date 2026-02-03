import { useAuth } from "@/src/services/authProvider";
import { useAuthStore } from "@/src/store/useAuthStore";
import * as AppleAuthentication from "expo-apple-authentication";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signIn, signUp, signInWithApple, loading, user, initialized } =
    useAuthStore();
  const { promptAsync, request } = useAuth();

  // Redirect after successful authentication
  useEffect(() => {
    if (initialized && user && redirectTo && !loading) {
      // Small delay to ensure navigation is ready and auth state is fully propagated
      const timeoutId = setTimeout(() => {
        router.replace(redirectTo as any);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else if (initialized && user && !redirectTo && !loading) {
      // If no redirect, go to home
      const timeoutId = setTimeout(() => {
        router.replace("/(tabs)");
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [user, initialized, redirectTo, loading]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }
      if (password.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters");
        return;
      }
    }

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      // Navigation will be handled by useEffect when user state updates
      // Don't navigate immediately - wait for auth state to propagate
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "An error occurred. Please try again."
      );
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
      // Navigation will be handled by useEffect when user state updates
    } catch (error: any) {
      if (!error?.message?.includes("cancelled")) {
        Alert.alert("Error", "Failed to sign in with Google");
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      // Navigation will be handled by useEffect when user state updates
    } catch (error: any) {
      if (error.message && !error.message.includes("cancelled")) {
        Alert.alert("Error", error.message || "Failed to sign in with Apple");
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-8">
            {/* Header */}
            <View className="mb-8">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-11 h-11 items-center justify-center mb-4 -ml-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={24} color="#3E3E3E" pointerEvents="none" />
              </TouchableOpacity>
              <Text
                className="text-3xl font-bold text-charcoal-gray mb-2"
                style={{ fontFamily: "Lora_700Bold" }}
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
              <Text className="text-base text-charcoal-gray/70">
                {isSignUp
                  ? "Join Saute to start managing your recipes"
                  : "Welcome back! Sign in to continue"}
              </Text>
            </View>

            {/* Email/Password Form */}
            <View className="mb-6">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Email
              </Text>
              <TextInput
                className="bg-soft-beige rounded-2xl px-4 text-charcoal-gray mb-4"
                style={{
                  height: 48,
                  paddingVertical: 12,
                  lineHeight: 20,
                  fontSize: 16,
                }}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />

              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Password
              </Text>
              <TextInput
                className="bg-soft-beige rounded-2xl px-4 text-charcoal-gray mb-4"
                style={{
                  height: 48,
                  paddingVertical: 12,
                  lineHeight: 20,
                  fontSize: 16,
                }}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />

              {isSignUp && (
                <>
                  <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                    Confirm Password
                  </Text>
                  <TextInput
                    className="bg-soft-beige rounded-2xl px-4 text-charcoal-gray mb-4"
                    style={{
                      height: 48,
                      paddingVertical: 12,
                      lineHeight: 20,
                      fontSize: 16,
                    }}
                    placeholder="Confirm your password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </>
              )}

              <TouchableOpacity
                className="bg-dark-sage rounded-2xl py-4 items-center justify-center mb-4"
                onPress={handleEmailAuth}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FAF9F7" />
                ) : (
                  <Text className="text-off-white text-base font-semibold">
                    {isSignUp ? "Sign Up" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setPassword("");
                  setConfirmPassword("");
                }}
                disabled={loading}
              >
                <Text className="text-center text-charcoal-gray/70 text-sm">
                  {isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View className="flex-row items-center my-4">
              <View className="flex-1 h-px bg-warm-sand" />
              <Text className="mx-4 text-charcoal-gray/50 text-sm">or</Text>
              <View className="flex-1 h-px bg-warm-sand" />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              className="bg-soft-beige rounded-2xl py-4 items-center justify-center border-2 border-warm-sand mb-4"
              onPress={handleGoogleSignIn}
              disabled={!request || loading}
              activeOpacity={0.8}
            >
              <Text className="text-charcoal-gray text-base font-semibold">
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Apple Sign In (iOS only) */}
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={16}
                style={{ width: "100%", height: 50 }}
                onPress={handleAppleSignIn}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

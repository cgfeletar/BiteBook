import { useAuthStore } from "@/src/store/useAuthStore";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signIn, signUp, loading } = useAuthStore();

  const handleSubmit = async () => {
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
      // Navigation will be handled by auth state change
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "An error occurred. Please try again."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Header */}
          <View className="mb-12 items-center">
            <Text className="text-4xl font-bold text-charcoal-gray mb-2">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </Text>
            <Text className="text-base text-charcoal-gray/70">
              {isSignUp ? "Sign up to get started" : "Sign in to continue"}
            </Text>
          </View>

          {/* Form */}
          <View>
            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Email
              </Text>
              <TextInput
                className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base"
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Password
              </Text>
              <TextInput
                className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base"
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? "password-new" : "password"}
                editable={!loading}
              />
            </View>

            {/* Confirm Password Input (Sign Up only) */}
            {isSignUp && (
              <View className="mb-4">
                <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                  Confirm Password
                </Text>
                <TextInput
                  className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base"
                  placeholder="Confirm your password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              className="bg-dark-sage rounded-2xl py-4 mt-6 items-center justify-center shadow-sm"
              onPress={handleSubmit}
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

            {/* Toggle Sign In/Sign Up */}
            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-charcoal-gray/70 text-sm">
                {isSignUp
                  ? "Already have an account? "
                  : "Don't have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setPassword("");
                  setConfirmPassword("");
                }}
                disabled={loading}
              >
                <Text className="text-dark-sage text-sm font-semibold">
                  {isSignUp ? "Sign In" : "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

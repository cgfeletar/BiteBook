import { useAuth } from "@/src/services/authProvider";
import { useAuthStore } from "@/src/store/useAuthStore";
import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  message?: string;
}

export function AuthPromptModal({
  visible,
  onClose,
  onSuccess,
  message = "Please sign in to continue",
}: AuthPromptModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signIn, signUp, signInWithApple, loading } = useAuthStore();
  const { promptAsync, request } = useAuth();

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
      onSuccess?.();
      onClose();
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
      // success is handled in AuthProvider's useEffect
      onSuccess?.();
      onClose();
    } catch (error: any) {
      if (!error?.message?.includes("cancelled")) {
        Alert.alert("Error", "Failed to sign in with Google");
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      if (error.message && !error.message.includes("cancelled")) {
        Alert.alert("Error", error.message || "Failed to sign in with Apple");
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-off-white" edges={["top"]}>
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-charcoal-gray mb-2">
              Sign In Required
            </Text>
            <Text className="text-base text-charcoal-gray/70">{message}</Text>
          </View>

          {/* Email/Password Form */}
          <View className="mb-6">
            <Text className="text-sm text-charcoal-gray mb-2 ml-1">Email</Text>
            <TextInput
              className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base mb-4"
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
              className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base mb-4"
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
                  className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal-gray text-base mb-4"
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

          {/* Close Button */}
          <TouchableOpacity
            className="mt-8 py-4 items-center"
            onPress={onClose}
            disabled={loading}
          >
            <Text className="text-charcoal-gray/60 text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

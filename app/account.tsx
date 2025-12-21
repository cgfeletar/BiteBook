import { useAuthStore } from "@/src/store/useAuthStore";
import { router } from "expo-router";
import {
  ArrowLeft,
  Edit2,
  LogOut,
  Mail,
  Palette,
  User,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen() {
  const { user, logout, updateUserDisplayName, loading } = useAuthStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");

  // Sync displayName when user changes
  useEffect(() => {
    setDisplayName(user?.displayName || "");
  }, [user?.displayName]);

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      Alert.alert("Required", "Please enter a name.");
      return;
    }

    try {
      await updateUserDisplayName(displayName.trim());
      setIsEditingName(false);
      Alert.alert("Success", "Your name has been updated.");
    } catch (error: any) {
      console.error("Error updating name:", error);
      const errorMessage =
        error?.message || "Failed to update name. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(user?.displayName || "");
    setIsEditingName(false);
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/(tabs)");
          } catch (error) {
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#3E3E3E" />
        </TouchableOpacity>
        <Text
          className="text-2xl font-bold text-charcoal flex-1 ml-4"
          style={{ fontFamily: "Lora_700Bold" }}
        >
          Account
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* User Info Section */}
        <View className="px-6 mb-6">
          <View className="bg-white rounded-2xl p-6 items-center">
            <View className="w-20 h-20 rounded-full bg-dark-sage items-center justify-center mb-4">
              {user?.photoURL ? (
                <Text className="text-white text-2xl font-bold">
                  {user.displayName?.[0]?.toUpperCase() ||
                    user.email?.[0]?.toUpperCase() ||
                    "U"}
                </Text>
              ) : (
                <User size={40} color="#FAF9F7" />
              )}
            </View>
            <View className="flex-row items-center mb-1">
              <Text
                className="text-xl font-bold text-charcoal"
                style={{ fontFamily: "Lora_700Bold" }}
              >
                {user?.displayName || "User"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDisplayName(user?.displayName || "");
                  setIsEditingName(true);
                }}
                className="ml-2"
                activeOpacity={0.7}
              >
                <Edit2 size={16} color="#5A6E6C" />
              </TouchableOpacity>
            </View>
            {user?.email && (
              <Text className="text-charcoal/70 text-sm">{user.email}</Text>
            )}
          </View>
        </View>

        {/* Settings Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-charcoal/60 mb-3 uppercase tracking-wide">
            Settings
          </Text>

          {/* Color Scheme */}
          <TouchableOpacity
            onPress={() => router.push("/coming-soon?title=Color Scheme")}
            className="bg-white rounded-xl p-4 flex-row items-center justify-between mb-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-soft-beige items-center justify-center mr-3">
                <Palette size={20} color="#5A6E6C" />
              </View>
              <View className="flex-1">
                <Text className="text-charcoal font-semibold text-base">
                  Color Scheme
                </Text>
                <Text className="text-charcoal/60 text-sm mt-0.5">
                  Choose your preferred color theme
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Kitchen Members */}
          <TouchableOpacity
            onPress={() => router.push("/coming-soon?title=Kitchen Members")}
            className="bg-white rounded-xl p-4 flex-row items-center justify-between mb-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-soft-beige items-center justify-center mr-3">
                <Users size={20} color="#5A6E6C" />
              </View>
              <View className="flex-1">
                <Text className="text-charcoal font-semibold text-base">
                  Kitchen Members
                </Text>
                <Text className="text-charcoal/60 text-sm mt-0.5">
                  Manage who has access to your kitchen
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Send Feedback */}
          <TouchableOpacity
            onPress={() => router.push("/feedback")}
            className="bg-white rounded-xl p-4 flex-row items-center justify-between mb-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-soft-beige items-center justify-center mr-3">
                <Mail size={20} color="#5A6E6C" />
              </View>
              <View className="flex-1">
                <Text className="text-charcoal font-semibold text-base">
                  Send Feedback
                </Text>
                <Text className="text-charcoal/60 text-sm mt-0.5">
                  Share your thoughts or ask a question
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Section */}
        <View className="px-6 mb-8">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-white rounded-xl p-4 flex-row items-center justify-center"
            activeOpacity={0.7}
          >
            <LogOut size={20} color="#7A2E2A" />
            <Text className="text-redwood font-semibold text-base ml-2">
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={isEditingName}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleCancelEdit}
            className="flex-1 bg-black/50 items-center justify-center px-6"
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
            >
              <Text
                className="text-xl font-bold text-charcoal mb-4"
                style={{ fontFamily: "Lora_700Bold" }}
              >
                Edit Name
              </Text>
              <TextInput
                className="bg-soft-beige rounded-xl px-4 py-3 text-charcoal text-base mb-4 border border-warm-sand/50"
                placeholder="Enter your name"
                placeholderTextColor="#9CA3AF"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                autoFocus
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  className="flex-1 bg-warm-sand/30 rounded-xl py-3 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-charcoal font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={loading || !displayName.trim()}
                  className={`flex-1 rounded-xl py-3 items-center ${
                    loading || !displayName.trim()
                      ? "bg-warm-sand/30"
                      : "bg-dark-sage"
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-semibold ${
                      loading || !displayName.trim()
                        ? "text-charcoal/50"
                        : "text-off-white"
                    }`}
                  >
                    {loading ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

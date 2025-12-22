import { useAuthStore } from "@/src/store/useAuthStore";
import { createKitchenInvite } from "@/src/services/kitchenInviteService";
import { buildInviteLink, buildWebInviteLink } from "@/src/utils/buildInviteLink";
import { router } from "expo-router";
import {
  ArrowLeft,
  Copy,
  Share2,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function KitchenMembersScreen() {
  const { user } = useAuthStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleInvite = async () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to invite members");
      return;
    }

    const kitchenId = user.defaultKitchenId;
    if (!kitchenId) {
      Alert.alert("Error", "No kitchen found. Please contact support.");
      return;
    }

    setIsGenerating(true);
    try {
      const inviteId = await createKitchenInvite(kitchenId, user.uid);
      const inviteLink = buildWebInviteLink(inviteId); // Use web link for sharing

      await Share.share({
        message: `Join my kitchen on Saute 🍳\n\n${inviteLink}`,
        title: "Invite to Kitchen",
      });
    } catch (error: any) {
      console.error("Error creating invite:", error);
      Alert.alert("Error", error?.message || "Could not create invite");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to copy invite link");
      return;
    }

    const kitchenId = user.defaultKitchenId;
    if (!kitchenId) {
      Alert.alert("Error", "No kitchen found. Please contact support.");
      return;
    }

    setIsGenerating(true);
    try {
      const inviteId = await createKitchenInvite(kitchenId, user.uid);
      const link = buildWebInviteLink(inviteId); // Use web link for copying

      await Clipboard.setStringAsync(link);
      Alert.alert("Copied", "Invite link copied to clipboard");
    } catch (error: any) {
      console.error("Error creating invite:", error);
      Alert.alert("Error", error?.message || "Could not create invite");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-off-white"
      edges={["top", "bottom"]}
    >
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
          Kitchen Members
        </Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 px-6">
        {/* Info Section */}
        <View className="bg-soft-beige rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <View className="mr-3 mt-0.5">
              <Users size={20} color="#5A6E6C" />
            </View>
            <View className="flex-1">
              <Text className="text-charcoal font-semibold text-sm mb-1">
                Invite others to your kitchen
              </Text>
              <Text className="text-charcoal/70 text-xs">
                Share an invite link via text, iMessage, WhatsApp, or email.
                Anyone with the link can join your kitchen.
              </Text>
            </View>
          </View>
        </View>

        {/* Invite Button */}
        <TouchableOpacity
          onPress={handleInvite}
          disabled={isGenerating}
          className={`rounded-xl p-4 flex-row items-center justify-center mb-3 ${
            isGenerating ? "bg-warm-sand/50" : "bg-dark-sage"
          }`}
          activeOpacity={0.7}
        >
          <Share2
            size={20}
            color={isGenerating ? "#9CA3AF" : "#FAF9F7"}
          />
          <Text
            className={`font-semibold text-base ml-2 ${
              isGenerating ? "text-charcoal/50" : "text-off-white"
            }`}
          >
            {isGenerating ? "Generating..." : "Invite to Kitchen"}
          </Text>
        </TouchableOpacity>

        {/* Copy Link Button */}
        <TouchableOpacity
          onPress={handleCopyInvite}
          disabled={isGenerating}
          className={`rounded-xl p-4 flex-row items-center justify-center border-2 ${
            isGenerating
              ? "border-warm-sand/30 bg-warm-sand/20"
              : "border-dark-sage bg-white"
          }`}
          activeOpacity={0.7}
        >
          <Copy
            size={20}
            color={isGenerating ? "#9CA3AF" : "#5A6E6C"}
          />
          <Text
            className={`font-semibold text-base ml-2 ${
              isGenerating ? "text-charcoal/50" : "text-dark-sage"
            }`}
          >
            {isGenerating ? "Generating..." : "Copy Invite Link"}
          </Text>
        </TouchableOpacity>

        {/* Members List Placeholder */}
        <View className="mt-8">
          <Text
            className="text-sm font-semibold text-charcoal/60 mb-3 uppercase tracking-wide"
          >
            Members
          </Text>
          <View className="bg-white rounded-xl p-4">
            <Text className="text-charcoal/70 text-sm text-center">
              Kitchen members will appear here
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}


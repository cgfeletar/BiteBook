import { useAuthStore } from "@/src/store/useAuthStore";
import { createKitchenInvite } from "@/src/services/kitchenInviteService";
import { getKitchenMembers, KitchenMember, createKitchen, removeKitchenMember } from "@/src/services/kitchenService";
import { getUserDocument, createOrUpdateUser } from "@/src/services/userService";
import { buildInviteLink, buildWebInviteLink } from "@/src/utils/buildInviteLink";
import { router } from "expo-router";
import {
  ArrowLeft,
  Copy,
  Share2,
  Users,
  Crown,
  MoreVertical,
  UserMinus,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Share,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

interface MemberWithDetails extends KitchenMember {
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export default function KitchenMembersScreen() {
  const { user, setUser } = useAuthStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [menuOpenForMember, setMenuOpenForMember] = useState<string | null>(null);

  // Check if current user is the owner
  const currentUserIsOwner = members.find(m => m.userId === user?.uid)?.role === "owner";

  const handleRemoveMember = async (member: MemberWithDetails) => {
    if (!user?.defaultKitchenId) return;

    const isRemovingSelf = member.userId === user.uid;
    const memberName = member.displayName || member.email || "this member";

    // Confirmation message based on whether removing self or another member
    const confirmTitle = isRemovingSelf ? "Leave Kitchen" : "Remove Member";
    const confirmMessage = isRemovingSelf
      ? "Are you sure you want to leave this kitchen? You'll need a new invite to rejoin."
      : `Are you sure you want to remove ${memberName} from this kitchen?`;

    Alert.alert(confirmTitle, confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: isRemovingSelf ? "Leave" : "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeKitchenMember(user.defaultKitchenId!, member.userId);
            
            if (isRemovingSelf) {
              // If leaving, create a new kitchen for the user
              const newKitchenId = `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              await createKitchen(user.uid, newKitchenId);
              await createOrUpdateUser({ ...user, defaultKitchenId: newKitchenId });
              setUser({ ...user, defaultKitchenId: newKitchenId });
              Alert.alert("Left Kitchen", "You've left the kitchen. A new kitchen has been created for you.");
            } else {
              // Refresh the members list
              loadMembers();
              Alert.alert("Success", `${memberName} has been removed from the kitchen.`);
            }
          } catch (error: any) {
            console.error("Error removing member:", error);
            Alert.alert("Error", error?.message || "Failed to remove member");
          }
        },
      },
    ]);
    setMenuOpenForMember(null);
  };

  const handleInvite = async () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to invite members");
      return;
    }

    setIsGenerating(true);
    try {
      // Ensure user has a kitchen - create one if they don't
      let kitchenId = user.defaultKitchenId;
      
      if (!kitchenId) {
        console.log("No kitchen found, creating one...");
        // Create a new kitchen for the user
        kitchenId = `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log("Creating kitchen with ID:", kitchenId);
        
        try {
          await createKitchen(user.uid, kitchenId);
          console.log("Kitchen created successfully");
        } catch (kitchenError: any) {
          console.error("Error creating kitchen:", kitchenError);
          throw new Error(`Failed to create kitchen: ${kitchenError?.message || kitchenError}`);
        }
        
        // Update user document with the new kitchen ID
        try {
          await createOrUpdateUser({
            ...user,
            defaultKitchenId: kitchenId,
          });
          console.log("User document updated with kitchen ID");
        } catch (userError: any) {
          console.error("Error updating user:", userError);
          throw new Error(`Failed to update user: ${userError?.message || userError}`);
        }
        
        // Update local state
        setUser({
          ...user,
          defaultKitchenId: kitchenId,
        });
      } else {
        console.log("Using existing kitchen ID:", kitchenId);
      }

      console.log("Creating invite for kitchen:", kitchenId);
      const inviteId = await createKitchenInvite(kitchenId, user.uid);
      console.log("Invite created with ID:", inviteId);
      
      const inviteLink = buildWebInviteLink(inviteId); // Use web link for sharing
      console.log("Invite link:", inviteLink);

      await Share.share({
        message: `Join my kitchen on Saute 🍳\n\n${inviteLink}`,
        title: "Invite to Kitchen",
      });
      
      console.log("Share dialog opened");
    } catch (error: any) {
      console.error("Error creating invite:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
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

    setIsGenerating(true);
    try {
      // Ensure user has a kitchen - create one if they don't
      let kitchenId = user.defaultKitchenId;
      
      if (!kitchenId) {
        console.log("No kitchen found, creating one...");
        // Create a new kitchen for the user
        kitchenId = `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log("Creating kitchen with ID:", kitchenId);
        
        try {
          await createKitchen(user.uid, kitchenId);
          console.log("Kitchen created successfully");
        } catch (kitchenError: any) {
          console.error("Error creating kitchen:", kitchenError);
          throw new Error(`Failed to create kitchen: ${kitchenError?.message || kitchenError}`);
        }
        
        // Update user document with the new kitchen ID
        try {
          await createOrUpdateUser({
            ...user,
            defaultKitchenId: kitchenId,
          });
          console.log("User document updated with kitchen ID");
        } catch (userError: any) {
          console.error("Error updating user:", userError);
          throw new Error(`Failed to update user: ${userError?.message || userError}`);
        }
        
        // Update local state
        setUser({
          ...user,
          defaultKitchenId: kitchenId,
        });
      } else {
        console.log("Using existing kitchen ID:", kitchenId);
      }

      console.log("Creating invite for kitchen:", kitchenId);
      const inviteId = await createKitchenInvite(kitchenId, user.uid);
      console.log("Invite created with ID:", inviteId);
      
      const link = buildWebInviteLink(inviteId); // Use web link for copying
      console.log("Invite link:", link);

      await Clipboard.setStringAsync(link);
      Alert.alert("Copied", "Invite link copied to clipboard");
    } catch (error: any) {
      console.error("Error creating invite:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      Alert.alert("Error", error?.message || "Could not create invite");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [user]);

  const loadMembers = async () => {
    if (!user?.defaultKitchenId) {
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    try {
      const kitchenMembers = await getKitchenMembers(user.defaultKitchenId);
      
      // Fetch user details for each member
      const membersWithDetails = await Promise.all(
        kitchenMembers.map(async (member) => {
          const userDoc = await getUserDocument(member.userId);
          return {
            ...member,
            displayName: userDoc?.displayName || undefined,
            email: userDoc?.email || undefined,
          };
        })
      );

      setMembers(membersWithDetails);
    } catch (error: any) {
      console.error("Error loading members:", error);
      Alert.alert("Error", "Failed to load kitchen members");
    } finally {
      setLoadingMembers(false);
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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24 }}>
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
          className={`rounded-xl p-4 flex-row items-center justify-center border-2 mb-8 ${
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

        {/* Members List */}
        <View className="mb-8">
          <Text
            className="text-sm font-semibold text-charcoal/60 mb-3 uppercase tracking-wide"
          >
            Members ({members.length})
          </Text>
          
          {loadingMembers ? (
            <View className="bg-white rounded-xl p-8 items-center justify-center">
              <ActivityIndicator size="small" color="#5A6E6C" />
              <Text className="text-charcoal/70 text-sm mt-2">Loading members...</Text>
            </View>
          ) : members.length === 0 ? (
            <View className="bg-white rounded-xl p-4">
              <Text className="text-charcoal/70 text-sm text-center">
                No members yet. Invite someone to get started!
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-xl overflow-hidden">
              {members.map((member, index) => (
                <View
                  key={member.userId}
                  className={`flex-row items-center p-4 ${
                    index < members.length - 1 ? "border-b border-warm-sand/30" : ""
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-dark-sage/20 items-center justify-center mr-3">
                    <Text className="text-dark-sage font-semibold text-sm">
                      {member.displayName?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-charcoal font-semibold text-base mr-2">
                        {member.displayName || member.email || "Unknown User"}
                      </Text>
                      {member.role === "owner" && (
                        <Crown size={16} color="#5A6E6C" />
                      )}
                    </View>
                    {member.displayName && member.email && (
                      <Text className="text-charcoal/60 text-sm mt-0.5">
                        {member.email}
                      </Text>
                    )}
                  </View>
                  {member.role === "owner" && (
                    <View className="bg-dark-sage/10 rounded-full px-3 py-1 mr-2">
                      <Text className="text-dark-sage text-xs font-semibold">
                        Owner
                      </Text>
                    </View>
                  )}
                  {/* Show menu for: owners can remove anyone, members can only remove themselves */}
                  {(currentUserIsOwner || member.userId === user?.uid) && (
                    <TouchableOpacity
                      onPress={() => setMenuOpenForMember(member.userId)}
                      className="w-10 h-10 items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <MoreVertical size={20} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Sheet Modal */}
      <Modal
        visible={menuOpenForMember !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpenForMember(null)}
      >
        <Pressable 
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setMenuOpenForMember(null)}
        >
          <Pressable 
            className="bg-white rounded-t-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>
            
            {/* Member info */}
            {menuOpenForMember && (
              <View className="px-6 pb-2">
                <Text className="text-charcoal/60 text-sm">
                  {members.find(m => m.userId === menuOpenForMember)?.displayName || 
                   members.find(m => m.userId === menuOpenForMember)?.email || 
                   "Member"}
                </Text>
              </View>
            )}
            
            {/* Remove/Leave button */}
            <TouchableOpacity
              onPress={() => {
                const member = members.find(m => m.userId === menuOpenForMember);
                if (member) handleRemoveMember(member);
              }}
              className="flex-row items-center px-6 py-4 border-t border-gray-100"
              activeOpacity={0.7}
            >
              <UserMinus size={20} color="#DC2626" />
              <Text className="text-red-600 ml-3 text-base font-medium">
                {menuOpenForMember === user?.uid ? "Leave Kitchen" : "Remove from Kitchen"}
              </Text>
            </TouchableOpacity>
            
            {/* Cancel button */}
            <TouchableOpacity
              onPress={() => setMenuOpenForMember(null)}
              className="px-6 py-4 border-t border-gray-100 mb-8"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal text-base font-medium text-center">
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}


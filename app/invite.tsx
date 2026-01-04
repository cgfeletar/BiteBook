import { useAuthStore } from "@/src/store/useAuthStore";
import { acceptKitchenInvite } from "@/src/services/kitchenInviteService";
import { extractInviteIdFromUrl } from "@/src/utils/buildInviteLink";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { CheckCircle, XCircle } from "lucide-react-native";
import { useEffect, useState, useRef } from "react";
import { Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserDocument, createOrUpdateUser } from "@/src/services/userService";

export default function InviteScreen() {
  const params = useLocalSearchParams();
  const [inviteId, setInviteId] = useState<string>("");
  const { user, setUser } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    console.log("[InviteScreen] Mounted, params:", params);
    
    // Get invite ID from params (Expo Router should parse this from the URL)
    const paramInviteId = params.inviteId as string;
    
    if (paramInviteId) {
      console.log("[InviteScreen] Found invite ID in params:", paramInviteId);
      setInviteId(paramInviteId);
      return;
    }

    // Fallback: Try to get from URL if not in params
    const getInviteIdFromUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        console.log("[InviteScreen] Initial URL:", url);
        if (url) {
          const extractedId = extractInviteIdFromUrl(url);
          console.log("[InviteScreen] Extracted invite ID:", extractedId);
          if (extractedId) {
            setInviteId(extractedId);
            return;
          }
        }
      } catch (error) {
        console.error("[InviteScreen] Error getting initial URL:", error);
      }

      // If still no invite ID after a delay, show error
      setTimeout(() => {
        if (!inviteId) {
          console.warn("[InviteScreen] No invite ID found");
          setStatus("error");
          setErrorMessage("Invalid invite link. No invite ID found.");
        }
      }, 2000);
    };

    getInviteIdFromUrl();

    // Listen for URL changes (when app is already running)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[InviteScreen] URL event:", event.url);
      const extractedId = extractInviteIdFromUrl(event.url);
      if (extractedId) {
        console.log("[InviteScreen] Extracted invite ID from URL event:", extractedId);
        setInviteId(extractedId);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [params.inviteId]);

  useEffect(() => {
    if (inviteId) {
      handleInviteAcceptance();
    }
  }, [inviteId, user]);

  const handleInviteAcceptance = async () => {
    if (!inviteId) {
      setStatus("error");
      setErrorMessage("Invalid invite link");
      return;
    }

    // If user is not signed in, redirect to login
    if (!user) {
      router.replace({
        pathname: "/(auth)/login",
        params: { redirectTo: `/invite?inviteId=${inviteId}` },
      });
      return;
    }

    try {
      // Accept the invite
      const kitchenId = await acceptKitchenInvite(inviteId, user.uid);

      // Update user's defaultKitchenId
      const userDoc = await getUserDocument(user.uid);
      if (userDoc) {
        // Update the user's kitchen ID
        await createOrUpdateUser({
          ...user,
          defaultKitchenId: kitchenId,
        });

        // Update local state
        setUser({
          ...user,
          defaultKitchenId: kitchenId,
        });
      }

      setStatus("success");
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      setStatus("error");
      setErrorMessage(
        error?.message ||
          "Failed to accept invite. It may have expired or already been used."
      );
    }
  };

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      className="flex-1 bg-off-white"
      edges={["top", "bottom"]}
    >
      <View className="flex-1 items-center justify-center px-6">
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color="#5A6E6C" className="mb-6" />
            <Text
              className="text-2xl font-bold text-charcoal mb-3 text-center"
              style={{ fontFamily: "Lora_700Bold" }}
            >
              Joining Kitchen...
            </Text>
            <Text className="text-charcoal/70 text-base text-center max-w-sm">
              Please wait while we add you to the kitchen.
            </Text>
          </>
        )}

        {status === "success" && (
          <>
            <View className="w-24 h-24 rounded-full bg-dark-sage items-center justify-center mb-6">
              <CheckCircle size={48} color="#FAF9F7" />
            </View>
            <Text
              className="text-2xl font-bold text-charcoal mb-3 text-center"
              style={{ fontFamily: "Lora_700Bold" }}
            >
              Successfully Joined!
            </Text>
            <Text className="text-charcoal/70 text-base text-center max-w-sm mb-8">
              You've been added to the kitchen. Start exploring recipes together!
            </Text>
            <TouchableOpacity
              onPress={handleGoHome}
              className="bg-dark-sage rounded-xl px-8 py-4"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold text-base">
                Go to Home
              </Text>
            </TouchableOpacity>
          </>
        )}

        {status === "error" && (
          <>
            <View className="w-24 h-24 rounded-full bg-redwood/20 items-center justify-center mb-6">
              <XCircle size={48} color="#7A2E2A" />
            </View>
            <Text
              className="text-2xl font-bold text-charcoal mb-3 text-center"
              style={{ fontFamily: "Lora_700Bold" }}
            >
              Unable to Join
            </Text>
            <Text className="text-charcoal/70 text-base text-center max-w-sm mb-8">
              {errorMessage || "Something went wrong. Please try again."}
            </Text>
            <TouchableOpacity
              onPress={handleGoHome}
              className="bg-dark-sage rounded-xl px-8 py-4"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold text-base">
                Go to Home
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}


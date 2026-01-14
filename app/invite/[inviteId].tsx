import { acceptKitchenInvite } from "@/src/services/kitchenInviteService";
import { migrateRecipesToKitchen } from "@/src/services/recipeFirestoreService";
import {
  createOrUpdateUser,
  getUserDocument,
} from "@/src/services/userService";
import { useAuthStore } from "@/src/store/useAuthStore";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle, XCircle } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Status = "loading" | "success" | "error";

export default function InviteScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const { user, setUser, loading: authLoading, initialized } = useAuthStore();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const hasProcessedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // If router didn't give us an inviteId, this link is invalid.
    if (!inviteId || typeof inviteId !== "string") {
      setStatus("error");
      setErrorMessage("Invalid invite link.");
      return;
    }

    // Wait for auth to initialize before checking user state
    if (!initialized || authLoading) {
      return;
    }

    // If user is not signed in, route to login and come back here.
    // Only redirect once to prevent infinite loops
    if (!user && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      const timeoutId = setTimeout(() => {
        router.replace({
          pathname: "/(auth)/login" as any,
          params: { redirectTo: `/invite/${inviteId}` },
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    // Prevent double-processing on auth hydration / re-renders
    if (hasProcessedRef.current || !user) return;
    hasProcessedRef.current = true;

    (async () => {
      try {
        setStatus("loading");

        // Step 1: Get the user's current kitchen ID before switching
        const userDoc = await getUserDocument(user.uid);
        const oldKitchenId = userDoc?.defaultKitchenId;
        console.log(`[InviteScreen] User's current kitchenId: ${oldKitchenId}`);

        // Step 2: Accept the invite (adds user to new kitchen members)
        const newKitchenId = await acceptKitchenInvite(inviteId, user.uid);
        console.log(`[InviteScreen] Joined new kitchen: ${newKitchenId}`);

        // Step 3: Migrate recipes from old kitchen to new kitchen (if different)
        if (oldKitchenId && oldKitchenId !== newKitchenId) {
          console.log(
            `[InviteScreen] Migrating recipes from ${oldKitchenId} to ${newKitchenId}`
          );
          try {
            const migratedCount = await migrateRecipesToKitchen(
              oldKitchenId,
              newKitchenId
            );
            console.log(
              `[InviteScreen] Successfully migrated ${migratedCount} recipes`
            );
          } catch (migrateError: any) {
            // Don't fail the whole invite if migration fails - log and continue
            console.error(
              `[InviteScreen] Recipe migration failed (non-fatal):`,
              migrateError?.message
            );
          }
        }

        // Step 4: Update user doc with new kitchenId
        console.log(
          `[InviteScreen] Updating user document with kitchenId: ${newKitchenId}`
        );
        await createOrUpdateUser({
          ...user,
          defaultKitchenId: newKitchenId,
        });

        // Update local state
        setUser({ ...user, defaultKitchenId: newKitchenId });

        setStatus("success");
      } catch (e: any) {
        hasProcessedRef.current = false;
        console.error("[InviteScreen] acceptKitchenInvite failed:", e);
        setStatus("error");
        setErrorMessage(
          e?.message ||
            "Failed to accept invite. It may have expired or already been used."
        );
      }
    })();
  }, [inviteId, user, initialized, authLoading]);

  const handleGoHome = () => router.replace("/(tabs)");

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
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
              You've been added to the kitchen. Start exploring recipes
              together!
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

import { AuthProvider } from "@/src/services/authProvider";
import { useAuthStore } from "@/src/store/useAuthStore";
import { Lora_400Regular, Lora_700Bold } from "@expo-google-fonts/lora";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { verifyInstallation } from "nativewind";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";
import "../global.css";
import "../nativewind-setup";

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

// Verify NativeWind installation
if (__DEV__) {
  verifyInstallation();
}

// Removed unstable_settings as it can interfere with deep linking
// Expo Router will handle universal links automatically

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
  });
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Expo Router should handle universal links automatically
  // But we'll add a fallback handler for cases where it doesn't work
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    // Listen for URL events (when app is already running)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[RootLayout] URL event received:", event.url);
      const url = event.url;

      // Extract invite ID - support both formats
      let inviteId: string | null = null;
      const deepLinkMatch = url.match(/bitebook:\/\/invite\/([a-zA-Z0-9]+)/);
      const universalLinkMatch = url.match(/\/invite\/([a-zA-Z0-9]+)/);

      if (deepLinkMatch) {
        inviteId = deepLinkMatch[1];
      } else if (universalLinkMatch) {
        inviteId = universalLinkMatch[1];
      }

      if (inviteId) {
        console.log("[RootLayout] Extracted invite ID:", inviteId);
        // Wait a bit for router to be ready, then navigate
        setTimeout(() => {
          router.push(`/invite?inviteId=${inviteId}`);
        }, 300);
      }
    });

    // Handle initial URL (when app opens from closed state)
    const handleInitialURL = async () => {
      try {
        const url = await Linking.getInitialURL();
        console.log("[RootLayout] Initial URL:", url);

        if (url) {
          let inviteId: string | null = null;
          const deepLinkMatch = url.match(
            /bitebook:\/\/invite\/([a-zA-Z0-9]+)/
          );
          const universalLinkMatch = url.match(/\/invite\/([a-zA-Z0-9]+)/);

          if (deepLinkMatch) {
            inviteId = deepLinkMatch[1];
          } else if (universalLinkMatch) {
            inviteId = universalLinkMatch[1];
          }

          if (inviteId) {
            console.log(
              "[RootLayout] Found invite ID from initial URL:",
              inviteId
            );
            // Wait for auth and router to be ready
            const navigateWhenReady = () => {
              const { initialized } = useAuthStore.getState();
              if (initialized) {
                console.log("[RootLayout] Auth ready, navigating to invite");
                setTimeout(() => {
                  router.push(`/invite?inviteId=${inviteId}`);
                }, 500);
              } else {
                console.log("[RootLayout] Waiting for auth...");
                setTimeout(navigateWhenReady, 200);
              }
            };
            setTimeout(navigateWhenReady, 500);
          }
        }
      } catch (error) {
        console.error("[RootLayout] Error handling initial URL:", error);
      }
    };

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [router, fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <View style={styles.container} className="flex-1 bg-off-white">
        <ThemeProvider value={DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="recipe-detail"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="book-detail"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="account"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="feedback"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="kitchen-members"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="coming-soon"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="invite"
              options={{ headerShown: false, presentation: "card" }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F7", // off-white fallback
  },
});

import { AuthProvider } from "@/src/services/authProvider";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";
import "../global.css";
import "../nativewind-setup";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const splashHidden = useRef(false);

  // Never allow an infinite splash hang
  useEffect(() => {
    const t = setTimeout(() => {
      if (!splashHidden.current) {
        SplashScreen.hideAsync().catch(() => {});
        splashHidden.current = true;
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Hide splash immediately (you can reintroduce fonts later once stable)
  useEffect(() => {
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        splashHidden.current = true;
      });
  }, []);

  // Invite deep link handler (only acts on /invite/<id>)
  useEffect(() => {
    let subscription: any;

    // Delay navigation until router is mounted
    const timeoutId = setTimeout(() => {
      const handleUrl = (url: string) => {
        if (!url) return;

        // ignore bare scheme launches that map to "/"
        if (url === "bitebook:///" || url === "bitebook://") return;

        const inviteMatch = url.match(/\/invite\/([a-zA-Z0-9]+)/);
        if (inviteMatch?.[1]) {
          router.replace(`/invite/${inviteMatch[1]}`);
        }
      };

      Linking.getInitialURL().then((url) => {
        if (url) handleUrl(url);
      });

      subscription = Linking.addEventListener("url", ({ url }) =>
        handleUrl(url)
      );
    }, 100); // Small delay to ensure router is mounted

    return () => {
      clearTimeout(timeoutId);
      if (subscription) {
        subscription.remove();
      }
    };
  }, [router]);

  return (
    <AuthProvider>
      <View style={styles.container}>
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="dark" />
        </ThemeProvider>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F7" },
});

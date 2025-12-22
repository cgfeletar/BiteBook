import { AuthProvider } from "@/src/services/authProvider";
import { Lora_400Regular, Lora_700Bold } from "@expo-google-fonts/lora";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
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

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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

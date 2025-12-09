import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { verifyInstallation } from 'nativewind';
import 'react-native-reanimated';
import '../global.css';
import '../nativewind-setup';

// Verify NativeWind installation
if (__DEV__) {
  verifyInstallation();
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <View style={styles.container} className="flex-1 bg-off-white">
      <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="recipe-detail" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="book-detail" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
        <StatusBar style="dark" />
    </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7', // off-white fallback
  },
});

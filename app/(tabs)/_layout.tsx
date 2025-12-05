import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { CustomTabBar } from '@/components/CustomTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="pantry" />
        <Tabs.Screen name="shopping" />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

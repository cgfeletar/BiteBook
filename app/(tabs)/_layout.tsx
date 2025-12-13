import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { CustomTabBar } from '@/components/CustomTabBar';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="shopping" />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

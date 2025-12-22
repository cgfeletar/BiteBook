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
        <Tabs.Screen name="meal-plan" />
        <Tabs.Screen name="shopping" />
      </Tabs>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'box-none' }}>
        <CustomTabBar />
      </View>
    </View>
  );
}

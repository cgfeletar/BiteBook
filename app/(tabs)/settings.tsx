import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-charcoal mb-4">Settings</Text>
        <Text className="text-charcoal-gray/60 text-base text-center">
          Settings functionality coming soon...
        </Text>
      </View>
    </SafeAreaView>
  );
}


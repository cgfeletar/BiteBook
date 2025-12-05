import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PantryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-charcoal mb-4">Pantry</Text>
        <Text className="text-charcoal-gray/60 text-base text-center">
          Pantry management coming soon...
        </Text>
      </View>
    </SafeAreaView>
  );
}


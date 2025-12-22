import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Clock } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ComingSoonScreen() {
  const params = useLocalSearchParams();
  const title = (params.title as string) || "Coming Soon";

  return (
    <SafeAreaView
      className="flex-1 bg-off-white"
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#3E3E3E" />
        </TouchableOpacity>
        <Text
          className="text-2xl font-bold text-charcoal flex-1 ml-4"
          style={{ fontFamily: "Lora_700Bold" }}
        >
          {title}
        </Text>
        <View className="w-10" />
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-24 h-24 rounded-full bg-soft-beige items-center justify-center mb-6">
          <Clock size={48} color="#5A6E6C" />
        </View>
        <Text
          className="text-2xl font-bold text-charcoal mb-3 text-center"
          style={{ fontFamily: "Lora_700Bold" }}
        >
          Coming Soon
        </Text>
        <Text className="text-charcoal/70 text-base text-center max-w-sm">
          We're working hard to bring you this feature. Check back soon!
        </Text>
      </View>
    </SafeAreaView>
  );
}




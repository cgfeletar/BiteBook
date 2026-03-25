import { useEffect, useState } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(100);

  useEffect(() => {
    if (toastMessage) {
      toastOpacity.value = withTiming(1, { duration: 300 });
      toastTranslateY.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        toastOpacity.value = withTiming(0, { duration: 300 });
        toastTranslateY.value = withTiming(100, { duration: 300 });
        setTimeout(() => setToastMessage(null), 300);
      }, 2000);
    }
  }, [toastMessage, toastOpacity, toastTranslateY]);

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastTranslateY.value }],
  }));

  return {
    toastMessage,
    showToast: setToastMessage,
    toastAnimatedStyle,
  };
}

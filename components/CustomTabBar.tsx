import { usePathname, useRouter, useSegments } from "expo-router";
import {
  BookOpen,
  Plus,
  Calendar,
  ShoppingBag,
  ChefHat,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for router to be ready
    if (pathname !== undefined) {
      setIsReady(true);
    }
  }, [pathname]);

  const tabs = [
    { name: "index", icon: BookOpen, route: "/(tabs)/" },
    { name: "shopping", icon: ShoppingBag, route: "/(tabs)/shopping" },
    { name: "add", icon: Plus, route: "/(tabs)/add", isMiddle: true },
    { name: "progress", icon: ChefHat, route: "/(tabs)/progress" },
    { name: "meal-plan", icon: Calendar, route: "/(tabs)/meal-plan" },
  ];

  const isActive = (route: string) => {
    if (!isReady || !pathname) return false;

    // Normalize routes by removing trailing slashes
    const normalizedRoute = route.replace(/\/$/, "");
    const normalizedPathname = pathname.replace(/\/$/, "");

    // Handle home/index route
    if (route === "/(tabs)/" || route === "/(tabs)") {
      const isHomeRoute =
        normalizedPathname === "/(tabs)" ||
        normalizedPathname === "/" ||
        normalizedPathname === "/(tabs)/index" ||
        (segments.length === 1 && segments[0] === "(tabs)");

      // Check if second segment is index (using type assertion to avoid TS error)
      if (segments.length === 2 && segments[0] === "(tabs)") {
        const secondSegment = segments[1] as string;
        return isHomeRoute || secondSegment === "index";
      }

      return isHomeRoute;
    }

    // Check exact match
    if (normalizedPathname === normalizedRoute) return true;

    // Check if pathname starts with route (for nested routes)
    if (normalizedPathname?.startsWith(normalizedRoute + "/")) return true;

    // Check segment match - get the tab name from route
    const routeParts = normalizedRoute.split("/");
    const tabName = routeParts[routeParts.length - 1];

    // Check if the last segment matches the tab name
    if (tabName && segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment === tabName;
    }

    return false;
  };

  const handlePress = (route: string) => {
    try {
      if (route === "/(tabs)/add") {
        // TODO: Open import modal or add recipe screen
        console.log("Add button pressed");
        router.push("/(tabs)/add");
        return;
      }
      router.push(route as any);
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <View
      style={[
        styles.tabBar,
        {
          bottom: insets.bottom,
          zIndex: 1000,
        },
      ]}
      pointerEvents="box-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.route);
        const isMiddle = tab.isMiddle;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => handlePress(tab.route)}
            activeOpacity={0.7}
            style={[styles.tabButton, isMiddle && styles.middleButton]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              size={isMiddle ? 28 : 24}
              color={isMiddle ? "#FAF9F7" : active ? "#5A6E6C" : "#9CA3AF"}
              strokeWidth={active || isMiddle ? 2.5 : 2}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
      },
    }),
  },
  tabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  middleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#5A6E6C",
    marginTop: -12,
  },
});

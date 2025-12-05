import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Plus, UtensilsCrossed, ShoppingBag } from 'lucide-react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';

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
    { name: 'index', icon: Home, route: '/(tabs)/' },
    { name: 'search', icon: Search, route: '/(tabs)/search' },
    { name: 'add', icon: Plus, route: '/(tabs)/add', isMiddle: true },
    { name: 'pantry', icon: UtensilsCrossed, route: '/(tabs)/pantry' },
    { name: 'shopping', icon: ShoppingBag, route: '/(tabs)/shopping' },
  ];

  const isActive = (route: string) => {
    if (!isReady || !pathname) return false;
    if (route === '/(tabs)/' || route === '/(tabs)') {
      return pathname === '/(tabs)/' || pathname === '/(tabs)' || pathname === '/' || segments.length === 0;
    }
    return pathname === route || pathname?.startsWith(route);
  };

  const handlePress = (route: string) => {
    try {
      if (route === '/(tabs)/add') {
        // TODO: Open import modal or add recipe screen
        console.log('Add button pressed');
        router.push('/(tabs)/add');
        return;
      }
      router.push(route as any);
    } catch (error) {
      console.error('Navigation error:', error);
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
          bottom: 30 + insets.bottom,
        },
      ]}
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
            style={[
              styles.tabButton,
              isMiddle && styles.middleButton,
              active && !isMiddle && styles.activeButton,
            ]}
          >
            <Icon
              size={isMiddle ? 28 : 24}
              color={isMiddle ? '#FAF9F7' : active ? '#C7D2C0' : '#9CA3AF'}
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
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C7D2C0',
    marginTop: -12,
  },
  activeButton: {
    backgroundColor: '#C7D2C0',
  },
});

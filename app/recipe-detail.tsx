import { View, Text, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Clock } from 'lucide-react-native';
import { RecipeCreateInput } from '@/src/types';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const HEADER_HEIGHT = 300;
const MIN_HEADER_HEIGHT = 100;

type TabType = 'ingredients' | 'instructions';

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const [recipeData, setRecipeData] = useState<RecipeCreateInput | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('ingredients');
  const isImported = params.isImported === 'true';
  const scrollY = useSharedValue(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (params.importedData) {
      try {
        const parsed = JSON.parse(params.importedData as string);
        setRecipeData(parsed);
      } catch (error) {
        console.error('Failed to parse recipe data:', error);
      }
    }
  }, [params.importedData]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerImageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.2, 1],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, -(HEADER_HEIGHT - MIN_HEADER_HEIGHT)],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const headerOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
    };
  });

  const headerContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [1, 0],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, -20],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  if (!recipeData) {
    return (
      <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-charcoal-gray text-base">Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-off-white">
      <SafeAreaView className="absolute top-0 left-0 right-0 z-10" edges={['top']}>
        {/* Header with Back Button */}
        <Animated.View
          style={[
            headerOverlayStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: '#FAF9F7',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
            style={{ width: 44, height: 44, justifyContent: 'center' }}
          >
            <ArrowLeft size={24} color="#3E3E3E" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-charcoal-gray ml-4 flex-1" numberOfLines={1}>
            {recipeData.title}
          </Text>
        </Animated.View>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 24 }}
      >
        {/* Collapsible Header Image */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: HEADER_HEIGHT,
              overflow: 'hidden',
            },
            headerImageStyle,
          ]}
        >
          {recipeData.coverImage ? (
            <Image
              source={{ uri: recipeData.coverImage }}
              style={{ width: '100%', height: HEADER_HEIGHT }}
              contentFit="cover"
              transition={200}
              placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
            />
          ) : (
            <View className="bg-soft-beige w-full h-full items-center justify-center">
              <Text className="text-charcoal-gray/50">No Image</Text>
            </View>
          )}
          
          {/* Gradient Overlay */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 128,
              backgroundColor: 'transparent',
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#FAF9F7',
                opacity: 0.3,
              }}
            />
          </View>
          
          {/* Header Content Overlay */}
          <SafeAreaView className="absolute top-0 left-0 right-0" edges={['top']}>
            <Animated.View
              style={[
                headerContentStyle,
                {
                  flex: 1,
                  justifyContent: 'flex-end',
                  paddingHorizontal: 24,
                  paddingBottom: 24,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <ArrowLeft size={20} color="#3E3E3E" />
              </TouchableOpacity>
              
              <Text className="text-3xl font-bold text-off-white mb-2" numberOfLines={2}>
                {recipeData.title}
              </Text>
              {recipeData.originalAuthor && (
                <Text className="text-base text-off-white/90">
                  By {recipeData.originalAuthor}
                </Text>
              )}
            </Animated.View>
          </SafeAreaView>
        </Animated.View>

        {/* Content */}
        <View className="px-6 pt-6 pb-8">
          {/* Imported Notice */}
          {isImported && (
            <View className="bg-sage-green/20 rounded-xl p-4 mb-6">
              <Text className="text-sage-green font-semibold text-sm">
                ✓ Recipe imported successfully! Review and save when ready.
              </Text>
            </View>
          )}

          {/* Segmented Control */}
          <View className="flex-row bg-soft-beige rounded-xl p-1 mb-6">
            <TouchableOpacity
              onPress={() => setActiveTab('ingredients')}
              className={`flex-1 py-3 rounded-lg items-center ${
                activeTab === 'ingredients' ? 'bg-sage-green' : ''
              }`}
              activeOpacity={0.7}
              style={{ minHeight: 44 }}
            >
              <Text
                className={`font-semibold ${
                  activeTab === 'ingredients' ? 'text-off-white' : 'text-charcoal-gray'
                }`}
              >
                Ingredients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('instructions')}
              className={`flex-1 py-3 rounded-lg items-center ${
                activeTab === 'instructions' ? 'bg-sage-green' : ''
              }`}
              activeOpacity={0.7}
              style={{ minHeight: 44 }}
            >
              <Text
                className={`font-semibold ${
                  activeTab === 'instructions' ? 'text-off-white' : 'text-charcoal-gray'
                }`}
              >
                Instructions
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ingredients Tab */}
          {activeTab === 'ingredients' && (
            <View>
              {recipeData.ingredients.map((ingredient, index) => (
                <TouchableOpacity
                  key={index}
                  className="flex-row items-center mb-3 bg-soft-beige rounded-xl px-4 py-4"
                  activeOpacity={0.7}
                  style={{ minHeight: 44 }}
                >
                  <View className="w-8 h-8 bg-sage-green rounded-full items-center justify-center mr-4">
                    <Text className="text-off-white font-bold text-xs">{index + 1}</Text>
                  </View>
                  <Text className="text-charcoal-gray flex-1 text-base">
                    <Text className="font-semibold">
                      {ingredient.quantity} {ingredient.unit}
                    </Text>{' '}
                    {ingredient.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Instructions Tab */}
          {activeTab === 'instructions' && (
            <View>
              {recipeData.steps.map((step, index) => (
                <TouchableOpacity
                  key={step.id}
                  className="mb-4 bg-soft-beige rounded-xl px-4 py-4"
                  activeOpacity={0.7}
                  style={{ minHeight: 44 }}
                >
                  <View className="flex-row items-start">
                    <View className="bg-sage-green rounded-full w-10 h-10 items-center justify-center mr-4 mt-1">
                      <Text className="text-off-white font-bold text-base">{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-charcoal-gray text-base leading-6">
                        {step.instruction}
                      </Text>
                      {step.timerDuration && (
                        <View className="flex-row items-center mt-2">
                          <Clock size={16} color="#9CA3AF" />
                          <Text className="text-charcoal-gray/60 text-sm ml-2">
                            {Math.floor(step.timerDuration / 60)} min
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nutritional Info */}
          {recipeData.nutritionalInfo && Object.keys(recipeData.nutritionalInfo).length > 0 && (
            <View className="mt-6 mb-6">
              <Text className="text-2xl font-bold text-charcoal-gray mb-4">Nutrition</Text>
              <View className="bg-soft-beige rounded-xl px-4 py-4">
                {recipeData.nutritionalInfo.calories && (
                  <Text className="text-charcoal-gray mb-2">
                    Calories: {recipeData.nutritionalInfo.calories}
                  </Text>
                )}
                {recipeData.nutritionalInfo.protein && (
                  <Text className="text-charcoal-gray mb-2">
                    Protein: {recipeData.nutritionalInfo.protein}g
                  </Text>
                )}
                {recipeData.nutritionalInfo.carbohydrates && (
                  <Text className="text-charcoal-gray mb-2">
                    Carbs: {recipeData.nutritionalInfo.carbohydrates}g
                  </Text>
                )}
                {recipeData.nutritionalInfo.fat && (
                  <Text className="text-charcoal-gray">
                    Fat: {recipeData.nutritionalInfo.fat}g
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Tags */}
          {recipeData.tags && recipeData.tags.length > 0 && (
            <View className="mb-6">
              <Text className="text-2xl font-bold text-charcoal-gray mb-4">Tags</Text>
              <View className="flex-row flex-wrap">
                {recipeData.tags.map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    className="bg-warm-sand rounded-full px-4 py-2 mr-2 mb-2"
                    activeOpacity={0.7}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text className="text-charcoal-gray text-sm">{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Source URL */}
          {recipeData.sourceUrl && (
            <View className="mb-6">
              <Text className="text-sm text-charcoal-gray/60">
                Source: {recipeData.sourceUrl}
              </Text>
            </View>
          )}

          {/* Save Button (for imported recipes) */}
          {isImported && (
            <TouchableOpacity
              className="bg-sage-green rounded-xl py-4 items-center justify-center mb-8"
              activeOpacity={0.8}
              onPress={() => {
                // TODO: Implement save to Firestore
                Alert.alert('Success', 'Recipe saved!');
              }}
              style={{ minHeight: 44 }}
            >
              <Text className="text-off-white text-base font-semibold">Save Recipe</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

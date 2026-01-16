import { Recipe } from "@/src/types";
import { Image } from "expo-image";
import { ChefHat, Clock, Heart } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
}

export function RecipeCard({
  recipe,
  onPress,
  onFavoritePress,
  isFavorite = false,
}: RecipeCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);

  const handleFavoritePress = () => {
    setFavorite(!favorite);
    onFavoritePress?.();
  };

  // Calculate total time from step timers
  const totalMinutes = useMemo(() => {
    if (!recipe.steps || recipe.steps.length === 0) return null;

    const totalSeconds = recipe.steps.reduce((sum, step) => {
      return sum + (step.timerDuration || 0);
    }, 0);

    if (totalSeconds === 0) return null;

    return Math.round(totalSeconds / 60);
  }, [recipe.steps]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className="mb-3">
      <View className="bg-soft-beige rounded-xl overflow-hidden shadow-sm">
        {/* Cover Image with Heart Overlay */}
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: recipe.coverImage }}
            style={{ width: "100%", aspectRatio: 0.85 }}
            contentFit="cover"
            transition={200}
            placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
          />

          {/* Heart Icon Overlay */}
          <View style={styles.heartContainer}>
            <TouchableOpacity
              onPress={handleFavoritePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              style={styles.heartButton}
            >
              <View style={styles.heartBackground}>
                <Heart
                  size={18}
                  color={favorite ? "#7A2E2A" : "#FFFFFF"}
                  fill={favorite ? "#7A2E2A" : "none"}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Overlay */}
        <View className="p-3">
          {/* Title */}
          <Text
            className="text-charcoal-gray font-semibold text-sm mb-1"
            numberOfLines={2}
          >
            {recipe.title || "Untitled Recipe"}
          </Text>

          {/* Time Display */}
          {(recipe.prepTime || recipe.cookTime || totalMinutes !== null) && (
            <View className="flex-row items-center gap-3">
              {/* Prep Time */}
              {recipe.prepTime && (
                <View className="flex-row items-center">
                  <ChefHat size={12} color="#9CA3AF" />
                  <Text className="text-charcoal-gray/60 text-xs ml-1">
                    {recipe.prepTime} prep
                  </Text>
                </View>
              )}
              {/* Cook Time - use recipe.cookTime if available, otherwise fall back to calculated total */}
              {(recipe.cookTime || totalMinutes !== null) && (
                <View className="flex-row items-center">
                  <Clock size={12} color="#9CA3AF" />
                  <Text className="text-charcoal-gray/60 text-xs ml-1">
                    {recipe.totalTime || totalMinutes} total
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heartContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
  },
  heartButton: {
    borderRadius: 20,
  },
  heartBackground: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});

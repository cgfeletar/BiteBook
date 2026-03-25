import { RecipeCreateInput } from "@/src/types";
import { ChefHat, Clock, Star, Users } from "lucide-react-native";
import React from "react";
import {
  TouchableOpacity as RNTouchableOpacity,
  Text,
  View,
} from "react-native";

interface RecipeInfoCardsProps {
  recipeData: RecipeCreateInput;
  servings: number;
  isEmptyRecipe: boolean;
}

export function RecipeInfoCards({
  recipeData,
  servings,
  isEmptyRecipe,
}: RecipeInfoCardsProps) {
  if (isEmptyRecipe) return null;

  const totalTime =
    recipeData.totalTime ||
    (() => {
      const totalSeconds =
        recipeData.steps?.reduce(
          (sum, step) => sum + (step.timerDuration || 0),
          0
        ) || 0;
      return totalSeconds > 0 ? Math.round(totalSeconds / 60) : null;
    })();

  return (
    <>
      <View className="flex-row items-center justify-between mb-4 gap-3">
        {recipeData.prepTime && (
          <View className="flex-1 bg-soft-beige rounded-xl px-4 py-3 items-center">
            <ChefHat size={20} color="#5A6E6C" />
            <Text className="text-charcoal-gray font-semibold text-base mt-1">
              {recipeData.prepTime} mins
            </Text>
            <Text className="text-charcoal-gray/60 text-xs mt-0.5">prep</Text>
          </View>
        )}

        {totalTime !== null && totalTime !== undefined && (
          <View className="flex-1 bg-soft-beige rounded-xl px-4 py-3 items-center">
            <Clock size={20} color="#5A6E6C" />
            <Text className="text-charcoal-gray font-semibold text-base mt-1">
              {totalTime} mins
            </Text>
            <Text className="text-charcoal-gray/60 text-xs mt-0.5">total</Text>
          </View>
        )}

        <View className="flex-1 bg-soft-beige rounded-xl px-4 py-3 items-center">
          <Users size={20} color="#5A6E6C" />
          <Text className="text-charcoal-gray font-semibold text-base mt-1">
            {servings}
          </Text>
          <Text className="text-charcoal-gray/60 text-xs mt-0.5">
            servings
          </Text>
        </View>
      </View>
      <View className="h-px bg-warm-sand mb-4" />
    </>
  );
}

interface StarRatingProps {
  rating: number | undefined;
  onRate: (star: number) => void;
}

export function StarRating({ rating, onRate }: StarRatingProps) {
  return (
    <>
      <View className="flex-row items-center justify-center mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <RNTouchableOpacity
            key={star}
            onPress={() => onRate(star)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={0.7}
          >
            <Star
              size={24}
              color={rating && star <= rating ? "#7A2E2A" : "#D1D5DB"}
              fill={rating && star <= rating ? "#7A2E2A" : "none"}
              pointerEvents="none"
            />
          </RNTouchableOpacity>
        ))}
      </View>
      <View className="h-px bg-warm-sand mb-6" />
    </>
  );
}

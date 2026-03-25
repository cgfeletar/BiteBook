import { NutritionalInfo } from "@/src/types";
import { formatDecimal } from "@/src/utils/fractionFormatter";
import { DAILY_VALUES } from "@/src/utils/recipeDetailUtils";
import React from "react";
import {
  ActivityIndicator,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  View,
} from "react-native";

interface NutritionPanelProps {
  nutritionalInfo: NutritionalInfo | undefined;
  isLoading: boolean;
  servings: number;
  viewByServing: boolean;
  onToggleView: (byServing: boolean) => void;
}

function NutrientRow({
  label,
  value,
  dailyValue,
  unit,
  servings,
  viewByServing,
}: {
  label: string;
  value: number;
  dailyValue: number;
  unit: string;
  servings: number;
  viewByServing: boolean;
}) {
  const displayValue = viewByServing ? value / servings : value;
  const percentage = (value / servings / dailyValue) * 100;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-charcoal-gray font-semibold">{label}</Text>
        <Text className="text-charcoal-gray font-semibold">
          {formatDecimal(displayValue)}
          {unit}
          {viewByServing && (
            <Text className="text-charcoal-gray/60 text-sm">
              {" "}
              / {dailyValue}
              {unit}
            </Text>
          )}
        </Text>
      </View>
      {viewByServing && (
        <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
          <View
            className="h-full bg-dark-sage rounded-full"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </View>
      )}
    </View>
  );
}

export function NutritionPanel({
  nutritionalInfo,
  isLoading,
  servings,
  viewByServing,
  onToggleView,
}: NutritionPanelProps) {
  if (!nutritionalInfo || Object.keys(nutritionalInfo).length === 0)
    return null;

  return (
    <View className="mt-6 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-charcoal-gray">Nutrition</Text>
        {!isLoading && (
          <View className="flex-row bg-soft-beige rounded-full p-1">
            <RNTouchableOpacity
              onPress={() => onToggleView(true)}
              className={`px-3 py-1.5 rounded-full items-center ${
                viewByServing ? "bg-dark-sage" : ""
              }`}
              activeOpacity={0.7}
              style={{ minHeight: 32, justifyContent: "center" }}
            >
              <Text
                className={`text-xs font-semibold ${
                  viewByServing ? "text-off-white" : "text-charcoal-gray"
                }`}
              >
                Per Serving
              </Text>
            </RNTouchableOpacity>
            <RNTouchableOpacity
              onPress={() => onToggleView(false)}
              className={`px-3 py-1.5 rounded-full items-center ${
                !viewByServing ? "bg-dark-sage" : ""
              }`}
              activeOpacity={0.7}
              style={{ minHeight: 32, justifyContent: "center" }}
            >
              <Text
                className={`text-xs font-semibold ${
                  !viewByServing ? "text-off-white" : "text-charcoal-gray"
                }`}
              >
                Whole Recipe
              </Text>
            </RNTouchableOpacity>
          </View>
        )}
      </View>

      <View className="bg-soft-beige rounded-xl px-4 py-4">
        {isLoading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator
              size="small"
              color="#5A6E6C"
              style={{ marginBottom: 8 }}
            />
            <Text className="text-charcoal-gray/60 text-sm">
              Calculating nutrition...
            </Text>
          </View>
        ) : (
          <>
            <NutrientRow
              label="Calories"
              value={nutritionalInfo.calories || 0}
              dailyValue={DAILY_VALUES.calories}
              unit=""
              servings={servings}
              viewByServing={viewByServing}
            />
            <NutrientRow
              label="Protein"
              value={nutritionalInfo.protein || 0}
              dailyValue={DAILY_VALUES.protein}
              unit="g"
              servings={servings}
              viewByServing={viewByServing}
            />
            <NutrientRow
              label="Carbs"
              value={nutritionalInfo.carbohydrates || 0}
              dailyValue={DAILY_VALUES.carbohydrates}
              unit="g"
              servings={servings}
              viewByServing={viewByServing}
            />
            <NutrientRow
              label="Sugar"
              value={nutritionalInfo.sugar || 0}
              dailyValue={DAILY_VALUES.sugar}
              unit="g"
              servings={servings}
              viewByServing={viewByServing}
            />
            <NutrientRow
              label="Fat"
              value={nutritionalInfo.fat || 0}
              dailyValue={DAILY_VALUES.fat}
              unit="g"
              servings={servings}
              viewByServing={viewByServing}
            />
            {nutritionalInfo.fiber && (
              <NutrientRow
                label="Fiber"
                value={nutritionalInfo.fiber}
                dailyValue={DAILY_VALUES.fiber}
                unit="g"
                servings={servings}
                viewByServing={viewByServing}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

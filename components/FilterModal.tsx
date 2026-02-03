import "@/nativewind-setup";
import { useProgressStore } from "@/src/store/useProgressStore";
import { Recipe } from "@/src/types";
import { Star, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export interface FilterState {
  mealTypes: string[];
  cuisines: string[];
  cookedBefore: "all" | "cooked" | "not-cooked";
  dietary: string[];
  minRating: number | null;
  sourceTypes: string[];
  nutritional: string[]; // e.g., "low-fat", "high-protein", "high-fiber", "low-sodium", "low-sugar", "low-calorie"
  customTags: string[]; // User-created custom tags
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  recipes: Recipe[];
}

const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "appetizer",
  "dessert",
  "brunch",
];

const CUISINES = [
  "italian",
  "mexican",
  "japanese",
  "french",
  "thai",
  "indian",
  "greek",
  "chinese",
  "american",
  "mediterranean",
  "korean",
  "spanish",
  "vietnamese",
  "middle-eastern",
];

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "keto",
  "paleo",
  "low-carb",
  "nut-free",
  "sugar-free",
];

const SOURCE_TYPES = [
  "tiktok",
  "instagram",
  "pinterest",
  "youtube",
  "blog",
  "website",
];

// Nutritional filter options with their thresholds (per serving)
// Based on FDA guidelines and MyPlate recommendations
const NUTRITIONAL_FILTERS = [
  {
    id: "low-fat",
    label: "Low Fat",
    description: "≤ 3g fat per serving",
    check: (nutrition: any) =>
      nutrition?.fat !== undefined && nutrition.fat <= 3,
  },
  {
    id: "high-protein",
    label: "High Protein",
    description: "≥ 10g protein per serving",
    check: (nutrition: any) =>
      nutrition?.protein !== undefined && nutrition.protein >= 10,
  },
  {
    id: "high-fiber",
    label: "High Fiber",
    description: "≥ 3g fiber per serving",
    check: (nutrition: any) =>
      nutrition?.fiber !== undefined && nutrition.fiber >= 3,
  },
  {
    id: "low-sodium",
    label: "Low Sodium",
    description: "≤ 140mg sodium per serving",
    check: (nutrition: any) =>
      nutrition?.sodium !== undefined && nutrition.sodium <= 140,
  },
  {
    id: "low-sugar",
    label: "Low Sugar",
    description: "≤ 5g sugar per serving",
    check: (nutrition: any) =>
      nutrition?.sugar !== undefined && nutrition.sugar <= 5,
  },
  {
    id: "low-calorie",
    label: "Low Calorie",
    description: "≤ 200 calories per serving",
    check: (nutrition: any) =>
      nutrition?.calories !== undefined && nutrition.calories <= 200,
  },
];

export function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
  recipes,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters);
  const cookingSessions = useProgressStore((state) => state.cookingSessions);
  const cookedRecipeIds = useMemo(
    () => new Set(cookingSessions.map((s) => s.recipeId)),
    [cookingSessions]
  );

  // Get available options from recipes
  const availableMealTypes = useMemo(() => {
    const types = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const lowerTag = tag.toLowerCase();
        MEAL_TYPES.forEach((type) => {
          if (lowerTag.includes(type)) {
            types.add(type);
          }
        });
      });
    });
    return Array.from(types).sort();
  }, [recipes]);

  const availableCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const lowerTag = tag.toLowerCase();
        CUISINES.forEach((cuisine) => {
          if (lowerTag.includes(cuisine)) {
            cuisines.add(cuisine);
          }
        });
      });
    });
    return Array.from(cuisines).sort();
  }, [recipes]);

  const availableDietary = useMemo(() => {
    const dietary = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const lowerTag = tag.toLowerCase();
        DIETARY_OPTIONS.forEach((option) => {
          if (lowerTag.includes(option)) {
            dietary.add(option);
          }
        });
      });
    });
    return Array.from(dietary).sort();
  }, [recipes]);

  const availableSourceTypes = useMemo(() => {
    const sourceTypes = new Set<string>();
    recipes.forEach((recipe) => {
      if (recipe.sourceUrl) {
        const url = recipe.sourceUrl.toLowerCase();
        if (url.includes("tiktok.com") || url.includes("vm.tiktok")) {
          sourceTypes.add("tiktok");
        } else if (
          url.includes("instagram.com") ||
          url.includes("instagr.am")
        ) {
          sourceTypes.add("instagram");
        } else if (url.includes("pinterest.com") || url.includes("pin.it")) {
          sourceTypes.add("pinterest");
        } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
          sourceTypes.add("youtube");
        } else if (
          url.includes("blog") ||
          url.includes("wordpress") ||
          url.includes("blogspot") ||
          url.includes("medium.com")
        ) {
          sourceTypes.add("blog");
        } else {
          // If it's a regular website (not social media)
          if (
            !url.includes("tiktok") &&
            !url.includes("instagram") &&
            !url.includes("pinterest") &&
            !url.includes("youtube")
          ) {
            sourceTypes.add("website");
          }
        }
      }
    });
    return Array.from(sourceTypes).sort();
  }, [recipes]);

  // Get all predefined tags to filter out custom tags
  const allPredefinedTags = useMemo(() => {
    const predefined = new Set<string>();
    MEAL_TYPES.forEach((tag) => predefined.add(tag.toLowerCase()));
    CUISINES.forEach((tag) => predefined.add(tag.toLowerCase()));
    DIETARY_OPTIONS.forEach((tag) => predefined.add(tag.toLowerCase()));
    return predefined;
  }, []);

  // Get custom tags (tags that aren't in predefined lists)
  const availableCustomTags = useMemo(() => {
    const customTags = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const lowerTag = tag.toLowerCase();
        // Check if tag matches any predefined category
        const isPredefined =
          MEAL_TYPES.some((type) => lowerTag.includes(type.toLowerCase())) ||
          CUISINES.some((cuisine) =>
            lowerTag.includes(cuisine.toLowerCase())
          ) ||
          DIETARY_OPTIONS.some((diet) => lowerTag.includes(diet.toLowerCase()));

        // Only add if it's not a predefined tag
        if (!isPredefined) {
          customTags.add(tag); // Keep original casing
        }
      });
    });
    return Array.from(customTags).sort();
  }, [recipes]);

  const toggleMealType = (type: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      mealTypes: prev.mealTypes.includes(type)
        ? prev.mealTypes.filter((t) => t !== type)
        : [...prev.mealTypes, type],
    }));
  };

  const toggleCuisine = (cuisine: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter((c) => c !== cuisine)
        : [...prev.cuisines, cuisine],
    }));
  };

  const toggleDietary = (option: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      dietary: prev.dietary.includes(option)
        ? prev.dietary.filter((d) => d !== option)
        : [...prev.dietary, option],
    }));
  };

  const toggleSourceType = (sourceType: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      sourceTypes: prev.sourceTypes.includes(sourceType)
        ? prev.sourceTypes.filter((s) => s !== sourceType)
        : [...prev.sourceTypes, sourceType],
    }));
  };

  const toggleNutritional = (nutritionalId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      nutritional: prev.nutritional.includes(nutritionalId)
        ? prev.nutritional.filter((n) => n !== nutritionalId)
        : [...prev.nutritional, nutritionalId],
    }));
  };

  const toggleCustomTag = (tag: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      customTags: prev.customTags.includes(tag)
        ? prev.customTags.filter((t) => t !== tag)
        : [...prev.customTags, tag],
    }));
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: FilterState = {
      mealTypes: [],
      cuisines: [],
      cookedBefore: "all",
      dietary: [],
      minRating: null,
      sourceTypes: [],
      nutritional: [],
      customTags: [],
    };
    setLocalFilters(resetFilters);
    onApply(resetFilters);
    onClose();
  };

  const formatLabel = (str: string) => {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.mealTypes.length > 0)
      count += localFilters.mealTypes.length;
    if (localFilters.cuisines.length > 0) count += localFilters.cuisines.length;
    if (localFilters.cookedBefore !== "all") count += 1;
    if (localFilters.dietary.length > 0) count += localFilters.dietary.length;
    if (localFilters.minRating !== null) count += 1;
    if (localFilters.sourceTypes.length > 0)
      count += localFilters.sourceTypes.length;
    if (localFilters.nutritional.length > 0)
      count += localFilters.nutritional.length;
    if (localFilters.customTags.length > 0)
      count += localFilters.customTags.length;
    return count;
  }, [localFilters]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end mb-4">
          <View className="bg-off-white rounded-t-3xl flex-1 max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-warm-sand/30">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-charcoal-gray">
                  Filters
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-11 h-11 items-center justify-center"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={24} color="#3E3E3E" pointerEvents="none" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="px-6 pt-6">
                {/* Meal Type Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Meal Type
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {availableMealTypes.length > 0 ? (
                      availableMealTypes.map((type) => {
                        const isSelected =
                          localFilters.mealTypes.includes(type);
                        return (
                          <TouchableOpacity
                            key={type}
                            onPress={() => toggleMealType(type)}
                            className={`rounded-full px-4 py-2 ${
                              isSelected
                                ? "bg-dark-sage"
                                : "bg-soft-beige border border-warm-sand/50"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {formatLabel(type)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text className="text-sm text-charcoal-gray/60">
                        No meal types available
                      </Text>
                    )}
                  </View>
                </View>

                {/* Cuisine Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Cuisine
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {availableCuisines.length > 0 ? (
                      availableCuisines.map((cuisine) => {
                        const isSelected =
                          localFilters.cuisines.includes(cuisine);
                        return (
                          <TouchableOpacity
                            key={cuisine}
                            onPress={() => toggleCuisine(cuisine)}
                            className={`rounded-full px-4 py-2 ${
                              isSelected
                                ? "bg-dark-sage"
                                : "bg-soft-beige border border-warm-sand/50"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {formatLabel(cuisine)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text className="text-sm text-charcoal-gray/60">
                        No cuisines available
                      </Text>
                    )}
                  </View>
                </View>

                {/* Cooked Before Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Cooked
                  </Text>
                  <View className="flex-row gap-3">
                    {[
                      { value: "all", label: "All Recipes" },
                      { value: "cooked", label: "Cooked" },
                      { value: "not-cooked", label: "Not Cooked" },
                    ].map((option) => {
                      const isSelected =
                        localFilters.cookedBefore === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() =>
                            setLocalFilters((prev) => ({
                              ...prev,
                              cookedBefore: option.value as
                                | "all"
                                | "cooked"
                                | "not-cooked",
                            }))
                          }
                          className={`flex-1 rounded-full px-4 py-2 ${
                            isSelected
                              ? "bg-dark-sage"
                              : "bg-soft-beige border border-warm-sand/50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <Text
                            className={`text-xs font-semibold text-center ${
                              isSelected ? "text-white" : "text-charcoal-gray"
                            }`}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Nutritional Content Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Nutritional Content
                  </Text>
                  <Text className="text-sm text-charcoal-gray/60 mb-3">
                    Filter by nutritional content per serving
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {NUTRITIONAL_FILTERS.map((filter) => {
                      const isSelected = localFilters.nutritional.includes(
                        filter.id
                      );
                      return (
                        <TouchableOpacity
                          key={filter.id}
                          onPress={() => toggleNutritional(filter.id)}
                          className={`rounded-full px-4 py-2 ${
                            isSelected
                              ? "bg-dark-sage"
                              : "bg-soft-beige border border-warm-sand/50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <View>
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {filter.label}
                            </Text>
                            <Text
                              className={`text-xs ${
                                isSelected
                                  ? "text-white/80"
                                  : "text-charcoal-gray/60"
                              }`}
                            >
                              {filter.description}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Rating Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Minimum Rating
                  </Text>
                  <View className="flex-row gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => {
                      const isSelected = localFilters.minRating === rating;
                      return (
                        <TouchableOpacity
                          key={rating}
                          onPress={() =>
                            setLocalFilters((prev) => ({
                              ...prev,
                              minRating: isSelected ? null : rating,
                            }))
                          }
                          className={`flex-1 rounded-full px-4 py-2 ${
                            isSelected
                              ? "bg-dark-sage"
                              : "bg-soft-beige border border-warm-sand/50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center justify-center">
                            <Star
                              size={16}
                              color={isSelected ? "#FAF9F7" : "#9CA3AF"}
                              fill={isSelected ? "#FAF9F7" : "transparent"}
                            />
                            <Text
                              className={`text-xs font-semibold ml-1 ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {rating}+
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Dietary Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Dietary
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {availableDietary.length > 0 ? (
                      availableDietary.map((option) => {
                        const isSelected =
                          localFilters.dietary.includes(option);
                        return (
                          <TouchableOpacity
                            key={option}
                            onPress={() => toggleDietary(option)}
                            className={`rounded-full px-4 py-2 ${
                              isSelected
                                ? "bg-dark-sage"
                                : "bg-soft-beige border border-warm-sand/50"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {formatLabel(option)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text className="text-sm text-charcoal-gray/60">
                        No dietary options available
                      </Text>
                    )}
                  </View>
                </View>

                {/* Source Type Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Source Type
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {availableSourceTypes.length > 0 ? (
                      availableSourceTypes.map((sourceType) => {
                        const isSelected =
                          localFilters.sourceTypes.includes(sourceType);
                        return (
                          <TouchableOpacity
                            key={sourceType}
                            onPress={() => toggleSourceType(sourceType)}
                            className={`rounded-full px-4 py-2 ${
                              isSelected
                                ? "bg-dark-sage"
                                : "bg-soft-beige border border-warm-sand/50"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {formatLabel(sourceType)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text className="text-sm text-charcoal-gray/60">
                        No source types available
                      </Text>
                    )}
                  </View>
                </View>

                {/* Custom Tags Section */}
                <View className="mb-6">
                  <Text className="text-lg font-bold text-charcoal-gray mb-3">
                    Custom Tags
                  </Text>
                  {availableCustomTags.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2">
                      {availableCustomTags.map((tag) => {
                        const isSelected =
                          localFilters.customTags.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            onPress={() => toggleCustomTag(tag)}
                            className={`rounded-full px-4 py-2 ${
                              isSelected
                                ? "bg-dark-sage"
                                : "bg-soft-beige border border-warm-sand/50"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                isSelected ? "text-white" : "text-charcoal-gray"
                              }`}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="text-sm text-charcoal-gray/60">
                      You don't have any custom tags yet. You can add custom
                      tags to recipes from the recipe detail page.
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View className="absolute bottom-0 left-0 right-0 bg-off-white border-t border-warm-sand/30 px-6 py-4 flex-row gap-3">
              <TouchableOpacity
                onPress={handleReset}
                className="flex-1 bg-soft-beige rounded-xl py-4 items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-base font-semibold text-charcoal-gray">
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                className="flex-1 bg-dark-sage rounded-xl py-4 items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-base font-semibold text-off-white">
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

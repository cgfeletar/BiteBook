import "@/nativewind-setup";
import { useProgressStore } from "@/src/store/useProgressStore";
import { Recipe } from "@/src/types";
import { Star, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

export interface FilterState {
  mealTypes: string[];
  cuisines: string[];
  cookedBefore: "all" | "cooked" | "not-cooked";
  dietary: string[];
  minRating: number | null;
  sourceTypes: string[];
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
    return count;
  }, [localFilters]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
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
              className="w-10 h-10 items-center justify-center"
              activeOpacity={0.7}
            >
              <X size={24} color="#3E3E3E" />
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
                      const isSelected = localFilters.mealTypes.includes(type);
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
                            className={`text-sm font-semibold ${
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
                            className={`text-sm font-semibold ${
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
                        className={`flex-1 rounded-full px-4 py-3 ${
                          isSelected
                            ? "bg-dark-sage"
                            : "bg-soft-beige border border-warm-sand/50"
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-semibold text-center ${
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

              {/* Dietary Section */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-charcoal-gray mb-3">
                  Dietary
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {availableDietary.length > 0 ? (
                    availableDietary.map((option) => {
                      const isSelected = localFilters.dietary.includes(option);
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
                            className={`text-sm font-semibold ${
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
                        className={`flex-1 rounded-xl px-3 py-3 ${
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
                            className={`text-sm font-semibold ml-1 ${
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
    </Modal>
  );
}

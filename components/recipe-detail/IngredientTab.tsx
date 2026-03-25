import { NutritionPanel } from "@/components/recipe-detail/NutritionPanel";
import { Ingredient, NutritionalInfo, PantryItem, ShoppingItem } from "@/src/types";
import { formatDecimal, formatQuantity } from "@/src/utils/fractionFormatter";
import { decodeHtmlEntities } from "@/src/utils/htmlDecoder";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";

interface IngredientTabProps {
  ingredients: Ingredient[];
  combinedIngredients: Ingredient[];
  missingFields: string[];
  recipeScale: 1 | 1.5 | 2 | 3;
  onScaleChange: (scale: 1 | 1.5 | 2 | 3) => void;
  // Pantry & shopping
  pantryItems: PantryItem[];
  shoppingItems: ShoppingItem[];
  checkedIngredients: Set<string>;
  onIngredientCheck: (name: string, ingredient: Ingredient) => void;
  onAddToShoppingList: () => void;
  shoppingListHasAdded: boolean;
  // Pantry move
  onAddToPantry: (ingredient: Ingredient) => void;
  onRemoveFromPantry: (ingredientName: string) => void;
  onUncheckIngredient: (ingredientName: string) => void;
  onShowToast: (message: string) => void;
  // Edit mode
  canEdit: boolean;
  isEditing: boolean;
  editedIngredients: Ingredient[];
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddIngredient: () => void;
  onDeleteIngredient: (index: number) => void;
  onUpdateIngredient: (
    index: number,
    field: keyof Ingredient,
    value: string | number | null
  ) => void;
  // Kitchenware
  kitchenware: string[];
  // Nutrition
  nutritionalInfo?: NutritionalInfo;
  isLoadingNutrition: boolean;
  servings: number;
  viewByServing: boolean;
  onToggleNutritionView: (byServing: boolean) => void;
}

export function IngredientTab({
  ingredients,
  combinedIngredients,
  missingFields,
  recipeScale,
  onScaleChange,
  pantryItems,
  shoppingItems,
  checkedIngredients,
  onIngredientCheck,
  onAddToShoppingList,
  shoppingListHasAdded,
  onAddToPantry,
  onRemoveFromPantry,
  onUncheckIngredient,
  onShowToast,
  canEdit,
  isEditing,
  editedIngredients,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddIngredient,
  onDeleteIngredient,
  onUpdateIngredient,
  kitchenware,
  nutritionalInfo,
  isLoadingNutrition,
  servings,
  viewByServing,
  onToggleNutritionView,
}: IngredientTabProps) {
  const [showKitchenware, setShowKitchenware] = useState(false);
  const [showScaleDropdown, setShowScaleDropdown] = useState(false);

  const isIngredientChecked = (ingredientName: string): boolean => {
    const normalizedName = ingredientName.toLowerCase().trim();
    return Array.from(checkedIngredients).some(
      (checked) => checked.toLowerCase().trim() === normalizedName
    );
  };

  const isIngredientInPantry = (ingredientName: string): boolean => {
    const normalizedName = ingredientName.toLowerCase().trim();
    return pantryItems.some(
      (item) => item.name.toLowerCase().trim() === normalizedName
    );
  };

  const { ingredientsInPantry, ingredientsToBuy } = useMemo(() => {
    if (!combinedIngredients || combinedIngredients.length === 0) {
      return { ingredientsInPantry: [], ingredientsToBuy: [] };
    }

    const inPantry: Ingredient[] = [];
    const toBuy: Ingredient[] = [];

    combinedIngredients.forEach((ing) => {
      if (isIngredientInPantry(ing.name) || isIngredientChecked(ing.name)) {
        inPantry.push(ing);
      } else {
        toBuy.push(ing);
      }
    });

    return { ingredientsInPantry: inPantry, ingredientsToBuy: toBuy };
  }, [combinedIngredients, pantryItems, checkedIngredients]);

  const progressInfo = useMemo(() => {
    const total = combinedIngredients.length;
    const inPantryCount = ingredientsInPantry.length;
    const percentage = total > 0 ? (inPantryCount / total) * 100 : 0;
    return { total, inPantryCount, percentage };
  }, [combinedIngredients.length, ingredientsInPantry.length]);

  const handleMoveIngredient = (
    ingredient: Ingredient,
    isInPantry: boolean
  ) => {
    if (isInPantry) {
      onRemoveFromPantry(ingredient.name);
      onUncheckIngredient(ingredient.name);
      onShowToast("Moved to Need to Buy");
    } else {
      onAddToPantry(ingredient);
      onShowToast("Moved to Pantry");
    }
  };

  const renderIngredient = (
    ingredient: Ingredient,
    index: number,
    isInPantry: boolean
  ) => {
    if (ingredient.unit === "to taste") {
      return (
        <View
          key={`${ingredient.name}-${index}`}
          className="flex-row items-center mb-3 bg-soft-beige rounded-xl px-4 py-4"
          style={{ minHeight: 44 }}
        >
          <Text className="flex-1 text-base text-charcoal-gray">
            {decodeHtmlEntities(ingredient.name)} to taste
          </Text>
          <RNTouchableOpacity
            onPress={() => handleMoveIngredient(ingredient, isInPantry)}
            className="ml-3 p-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            {isInPantry ? (
              <ShoppingBag size={18} color="#5A6E6C" pointerEvents="none" />
            ) : (
              <Package size={18} color="#5A6E6C" pointerEvents="none" />
            )}
          </RNTouchableOpacity>
        </View>
      );
    }

    const scaledQuantity = (ingredient.quantity || 0) * recipeScale;
    const quantityToFormat =
      typeof scaledQuantity === "number"
        ? scaledQuantity
        : typeof scaledQuantity === "string"
        ? parseFloat(scaledQuantity) || 0
        : 0;
    const shouldShowQuantity = quantityToFormat > 0;
    const formattedQuantity = shouldShowQuantity
      ? formatQuantity(quantityToFormat, ingredient.unit)
      : "";

    return (
      <View
        key={`${ingredient.name}-${index}`}
        className="flex-row items-center mb-3 bg-soft-beige rounded-xl px-4 py-4"
        style={{ minHeight: 44 }}
      >
        <Text className="flex-1 text-base text-charcoal-gray">
          {shouldShowQuantity && (
            <>
              <Text className="font-semibold">{formattedQuantity}</Text>
              {ingredient.unit && (
                <>
                  {" "}
                  <Text className="font-semibold">{ingredient.unit}</Text>
                </>
              )}{" "}
            </>
          )}
          {decodeHtmlEntities(ingredient.name)}
        </Text>
        <RNTouchableOpacity
          onPress={() => handleMoveIngredient(ingredient, isInPantry)}
          className="ml-3 p-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          {isInPantry ? (
            <ShoppingBag size={18} color="#5A6E6C" pointerEvents="none" />
          ) : (
            <Package size={18} color="#5A6E6C" pointerEvents="none" />
          )}
        </RNTouchableOpacity>
      </View>
    );
  };

  return (
    <View
      className={
        missingFields.includes("ingredients")
          ? "border-2 border-dusty-rose rounded-xl p-4"
          : ""
      }
    >
      {/* Kitchenware Section */}
      {kitchenware.length > 0 && (
        <View className="mb-4 bg-soft-beige rounded-xl p-4">
          <RNTouchableOpacity
            onPress={() => setShowKitchenware(!showKitchenware)}
            className="flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <Text className="text-md font-bold text-charcoal-gray">
              Kitchenware Needed
            </Text>
            {showKitchenware ? (
              <ChevronDown size={20} color="#3E3E3E" pointerEvents="none" />
            ) : (
              <ChevronUp size={20} color="#3E3E3E" pointerEvents="none" />
            )}
          </RNTouchableOpacity>
          {showKitchenware && (
            <View className="flex-row flex-wrap mt-2">
              {kitchenware.map((item, index) => (
                <View
                  key={index}
                  className="flex-row items-start mb-2"
                  style={{ width: "48%" }}
                >
                  <View className="w-2 h-2 rounded-full bg-dark-sage mr-3 mt-2 flex-shrink-0" />
                  <Text className="text-sm text-charcoal-gray flex-1 flex-wrap">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Scale Dropdown Backdrop */}
      {showScaleDropdown && (
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
          }}
          onPress={() => setShowScaleDropdown(false)}
        />
      )}
      <View className="flex-row items-center justify-between mb-4">
        <View
          className="flex-1 mr-3 flex-row items-center"
          style={{ zIndex: showScaleDropdown ? 100 : 1 }}
        >
          <Text className="text-charcoal-gray/60 text-sm mr-2">Scale:</Text>
          <View className="flex-1">
            <RNTouchableOpacity
              onPress={() => setShowScaleDropdown(!showScaleDropdown)}
              className="bg-soft-beige rounded-xl px-4 py-3 flex-row items-center justify-between"
              activeOpacity={0.7}
              style={{ minHeight: 44 }}
            >
              <Text className="text-charcoal-gray font-semibold text-sm">
                {recipeScale}x
              </Text>
              <ChevronDown
                size={18}
                color="#3E3E3E"
                pointerEvents="none"
                style={{
                  transform: [
                    { rotate: showScaleDropdown ? "180deg" : "0deg" },
                  ],
                }}
              />
            </RNTouchableOpacity>
            {showScaleDropdown && (
              <View className="absolute top-full left-0 right-0 mt-1 bg-off-white rounded-xl shadow-lg border border-warm-sand/50 overflow-hidden z-50">
                {([1, 1.5, 2, 3] as const).map((scale) => (
                  <RNTouchableOpacity
                    key={scale}
                    onPress={() => {
                      onScaleChange(scale);
                      setShowScaleDropdown(false);
                    }}
                    className={`px-4 py-3 ${
                      recipeScale === scale ? "bg-dark-sage" : ""
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        recipeScale === scale
                          ? "text-off-white"
                          : "text-charcoal-gray"
                      }`}
                    >
                      {scale}x
                    </Text>
                  </RNTouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Edit Mode Header */}
      {isEditing && (
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-charcoal-gray">
            Edit Ingredients
          </Text>
          <View className="flex-row gap-2">
            <RNTouchableOpacity
              onPress={onCancelEdit}
              className="bg-warm-sand rounded-lg px-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal-gray font-semibold">Cancel</Text>
            </RNTouchableOpacity>
            <RNTouchableOpacity
              onPress={onSaveEdit}
              className="bg-dark-sage rounded-lg px-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold">Save</Text>
            </RNTouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress Tracker */}
      {!isEditing && combinedIngredients.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-semibold text-charcoal-gray">
              Ingredients in Pantry
            </Text>
            <Text className="text-sm text-charcoal-gray/60">
              {progressInfo.inPantryCount} / {progressInfo.total}
            </Text>
          </View>
          <View className="h-2 bg-warm-sand rounded-full overflow-hidden">
            <View
              className="h-full bg-dark-sage rounded-full transition-all"
              style={{ width: `${progressInfo.percentage}%` }}
            />
          </View>
        </View>
      )}

      {/* Edit Mode: Editable ingredients */}
      {isEditing ? (
        <View className="mb-6">
          {editedIngredients.map((ingredient, index) => (
            <View
              key={index}
              className="mb-3 bg-soft-beige rounded-xl px-4 py-3 flex-row items-center"
            >
              <View className="flex-1 flex-row items-center gap-2">
                <TextInput
                  value={
                    ingredient.quantity === null
                      ? ""
                      : formatDecimal(ingredient.quantity)
                  }
                  onChangeText={(text) => {
                    if (text === "" || text === "to taste") {
                      onUpdateIngredient(index, "quantity", null);
                      if (text === "to taste") {
                        onUpdateIngredient(index, "unit", "to taste");
                      }
                    } else {
                      const num = parseFloat(text);
                      if (!isNaN(num)) {
                        onUpdateIngredient(index, "quantity", num);
                      }
                    }
                  }}
                  placeholder="Qty"
                  className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                  style={{ minWidth: 60, maxWidth: 80 }}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  value={ingredient.unit}
                  onChangeText={(text) =>
                    onUpdateIngredient(index, "unit", text)
                  }
                  placeholder="Unit"
                  className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                  style={{ minWidth: 80, maxWidth: 120 }}
                />
                <TextInput
                  value={decodeHtmlEntities(ingredient.name)}
                  onChangeText={(text) =>
                    onUpdateIngredient(index, "name", text)
                  }
                  placeholder="Ingredient name"
                  className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-2"
                  style={{ flex: 2 }}
                />
              </View>
              <RNTouchableOpacity
                onPress={() => onDeleteIngredient(index)}
                className="ml-2 w-10 h-10 items-center justify-center"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={20} color="#D7B4B3" pointerEvents="none" />
              </RNTouchableOpacity>
            </View>
          ))}
          <RNTouchableOpacity
            onPress={onAddIngredient}
            className="bg-dark-sage rounded-xl py-3 px-4 flex-row items-center justify-center mb-4"
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FAF9F7" />
            <Text className="text-off-white font-semibold ml-2">
              Add Ingredient
            </Text>
          </RNTouchableOpacity>
        </View>
      ) : (
        <>
          {/* Missing Ingredients Message */}
          {missingFields.includes("ingredients") &&
            combinedIngredients.length === 0 && (
              <View className="mb-6 bg-dusty-rose/10 border border-dusty-rose rounded-xl p-4">
                <Text className="text-dusty-rose font-semibold mb-1">
                  ⚠️ Ingredients not detected
                </Text>
                <Text className="text-charcoal-gray/70 text-sm">
                  We couldn't extract ingredients from the image. Please add
                  them manually using the Edit button.
                </Text>
              </View>
            )}

          {/* Need to Buy Section */}
          {ingredientsToBuy.length > 0 && (
            <View className="mb-6">
              {shoppingListHasAdded ? (
                <View className="bg-soft-beige rounded-xl py-3 px-4 mb-4 flex-row items-center justify-center">
                  <Check size={20} color="#5A6E6C" />
                  <Text className="text-dark-sage text-base font-semibold ml-2">
                    Ingredients added to shopping list
                  </Text>
                </View>
              ) : (
                <RNTouchableOpacity
                  onPress={onAddToShoppingList}
                  className="bg-dark-sage rounded-xl py-3 px-4 mb-4 flex-row items-center justify-center"
                  activeOpacity={0.8}
                  style={{ minHeight: 44 }}
                >
                  <ShoppingBag size={20} color="#FAF9F7" />
                  <Text className="text-off-white text-base font-semibold ml-2">
                    Add All to Shopping List
                  </Text>
                </RNTouchableOpacity>
              )}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-charcoal-gray">
                  Need to Buy
                </Text>
                {canEdit && (
                  <RNTouchableOpacity
                    onPress={onStartEdit}
                    className="flex-row items-center bg-soft-beige rounded-lg px-3 py-2"
                    activeOpacity={0.7}
                  >
                    <Pencil size={16} color="#5A6E6C" />
                    <Text className="text-dark-sage font-semibold ml-2">
                      Edit
                    </Text>
                  </RNTouchableOpacity>
                )}
              </View>
              <View className="mb-3 items-end flex-row justify-end">
                <Text className="text-xs text-charcoal-gray/50 text-right">
                  Tap{" "}
                </Text>
                <Package
                  size={12}
                  color="#9CA3AF"
                  style={{ marginHorizontal: 2 }}
                />
                <Text className="text-xs text-charcoal-gray/50 text-right">
                  to mark items you already have
                </Text>
              </View>
              {ingredientsToBuy.map((ingredient, index) =>
                renderIngredient(ingredient, index, false)
              )}
            </View>
          )}

          {/* Already in Pantry Section */}
          {ingredientsInPantry.length > 0 && (
            <View className="mb-6">
              <Text className="text-xl font-bold text-charcoal-gray mb-4">
                In My Pantry
              </Text>
              {ingredientsInPantry.map((ingredient, index) =>
                renderIngredient(
                  ingredient,
                  ingredientsToBuy.length + index,
                  true
                )
              )}
            </View>
          )}
        </>
      )}

      {/* Nutrition Section */}
      <NutritionPanel
        nutritionalInfo={nutritionalInfo}
        isLoading={isLoadingNutrition}
        servings={servings}
        viewByServing={viewByServing}
        onToggleView={onToggleNutritionView}
      />
    </View>
  );
}

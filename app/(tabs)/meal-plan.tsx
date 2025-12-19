import "@/nativewind-setup";
import {
  DayMealPlan,
  MealPlanItem,
  useMealPlanStore,
} from "@/src/store/useMealPlanStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Plus, Search, Trash2, User, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

type WeekView = "thisWeek" | "nextWeek" | "custom";

export default function MealPlanScreen() {
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});
  const [selectedWeek, setSelectedWeek] = useState<WeekView>("thisWeek");
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [customMealName, setCustomMealName] = useState("");
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

  const { mealPlans, addMeal, removeMeal } = useMealPlanStore();
  const { recipes } = useRecipeStore();

  // Get the start date for the selected week
  const getWeekStartDate = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday as start
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    if (selectedWeek === "thisWeek") {
      return monday;
    } else if (selectedWeek === "nextWeek") {
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      return nextMonday;
    } else {
      // Custom week - for now, show next week + 1
      const customMonday = new Date(monday);
      customMonday.setDate(customMonday.getDate() + 14);
      return customMonday;
    }
  };

  const weekStartDate = getWeekStartDate();

  // Compute week meals reactively from mealPlans
  const weekMeals = useMemo(() => {
    const weekDates: DayMealPlan[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split("T")[0];
      const dayPlan = mealPlans.find((plan) => plan.date === dateString);
      weekDates.push(dayPlan || { date: dateString, meals: [] });
    }
    return weekDates;
  }, [mealPlans, weekStartDate]);

  const formatWeekRange = (startDate: Date): string => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const startMonth = startDate.toLocaleDateString("en-US", {
      month: "short",
    });
    const startDay = startDate.getDate();
    const endMonth = endDate.toLocaleDateString("en-US", { month: "short" });
    const endDay = endDate.getDate();
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  const handleAddMeal = (date: string) => {
    // Ensure date is in YYYY-MM-DD format
    const normalizedDate = date.split("T")[0];
    setSelectedDate(normalizedDate);
    setShowAddMealModal(true);
  };

  const handleSaveMeal = () => {
    if (customMealName.trim() && selectedDate) {
      // Ensure date is in YYYY-MM-DD format
      const normalizedDate = selectedDate.split("T")[0];
      addMeal(normalizedDate, {
        name: customMealName.trim(),
        isCustom: true,
      });
      setCustomMealName("");
      setShowAddMealModal(false);
    }
  };

  const handleAddRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe && selectedDate) {
      // Ensure date is in YYYY-MM-DD format
      const normalizedDate = selectedDate.split("T")[0];
      addMeal(normalizedDate, {
        name: recipe.title,
        recipeId: recipe.id,
        isCustom: false,
      });
      setShowRecipePicker(false);
      setShowAddMealModal(false);
      setRecipeSearchQuery("");
    }
  };

  const formatDayName = (date: Date): string => {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatDayNumber = (date: Date): string => {
    return date.getDate().toString();
  };

  const formatFullDayName = (date: Date): string => {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const isCurrentDay = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const renderSwipeRightAction = (meal: MealPlanItem, date: string) => {
    return (
      <View
        className="bg-redwood rounded-2xl items-center justify-center px-6 mb-2"
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: 60,
        }}
      >
        <View className="items-center">
          <Trash2 size={24} color="#FAF9F7" />
        </View>
      </View>
    );
  };

  const handleSwipeRemove = (mealId: string, date: string) => {
    removeMeal(date, mealId);
    // Close the swipeable after removal
    const swipeable = swipeableRefs.current[mealId];
    if (swipeable) {
      swipeable.close();
    }
  };

  // Filter recipes based on search query
  const filteredRecipes = useMemo(() => {
    if (!recipeSearchQuery.trim()) {
      return recipes;
    }
    const query = recipeSearchQuery.toLowerCase().trim();
    return recipes.filter((recipe) =>
      recipe.title.toLowerCase().includes(query)
    );
  }, [recipes, recipeSearchQuery]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1 bg-off-white pb-24"
        edges={["top", "bottom"]}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
          <Text className="text-3xl font-bold text-charcoal">Meal Plan</Text>
          <TouchableOpacity
            onPress={() => router.push("/account")}
            className="w-10 h-10 rounded-full bg-warm-sand items-center justify-center"
            activeOpacity={0.7}
          >
            <User size={20} color="#3E3E3E" />
          </TouchableOpacity>
        </View>

        {/* Week Navigation */}
        <View className="flex-row gap-3 px-6 mb-4">
          <TouchableOpacity
            onPress={() => setSelectedWeek("thisWeek")}
            className={`px-4 py-2 rounded-full ${
              selectedWeek === "thisWeek" ? "bg-dark-sage" : "bg-warm-sand/30"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedWeek === "thisWeek" ? "text-white" : "text-charcoal/70"
              }`}
            >
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedWeek("nextWeek")}
            className={`px-4 py-2 rounded-full ${
              selectedWeek === "nextWeek" ? "bg-dark-sage" : "bg-warm-sand/30"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedWeek === "nextWeek" ? "text-white" : "text-charcoal/70"
              }`}
            >
              Next Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedWeek("custom")}
            className={`px-4 py-2 rounded-full ${
              selectedWeek === "custom" ? "bg-dark-sage" : "bg-warm-sand/30"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedWeek === "custom" ? "text-white" : "text-charcoal/70"
              }`}
            >
              {formatWeekRange(
                (() => {
                  const customDate = new Date(weekStartDate);
                  customDate.setDate(customDate.getDate() + 14);
                  return customDate;
                })()
              )}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Meal Plan List */}
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
        >
          {weekMeals.map((dayPlan, index) => {
            const date = new Date(dayPlan.date);
            const isToday = isCurrentDay(date);
            const meals = dayPlan.meals;

            return (
              <View
                key={dayPlan.date}
                className={`flex-row ${meals.length === 0 ? "mb-0" : "mb-6"}`}
              >
                {/* Date Indicator with connecting line */}
                <View className="items-center mr-4">
                  <View
                    className={`w-14 h-14 rounded-full items-center justify-center ${
                      isToday ? "bg-dark-sage" : "bg-warm-sand/50"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isToday ? "text-white" : "text-charcoal"
                      }`}
                    >
                      {formatDayName(date)}
                    </Text>
                    <Text
                      className={`text-base font-bold ${
                        isToday ? "text-white" : "text-charcoal"
                      }`}
                    >
                      {formatDayNumber(date)}
                    </Text>
                  </View>
                  {index < weekMeals.length - 1 && (
                    <View className="w-0.5 h-16 bg-warm-sand/30 mt-2" />
                  )}
                </View>

                {/* Day Content */}
                <View className="flex-1">
                  <View className="mb-2">
                    <Text className="text-lg font-semibold text-charcoal mb-1">
                      {formatFullDayName(date)}
                    </Text>
                    {meals.length > 0 && (
                      <Text className="text-sm text-charcoal/60">
                        {meals.length} {meals.length === 1 ? "meal" : "meals"}
                      </Text>
                    )}
                  </View>

                  {/* Meals List */}
                  {meals.length > 0 && (
                    <View className="mt-2">
                      {meals.map((meal) => (
                        <Swipeable
                          key={meal.id}
                          ref={(ref) => {
                            if (ref) {
                              swipeableRefs.current[meal.id] = ref;
                            }
                          }}
                          renderRightActions={() =>
                            renderSwipeRightAction(meal, dayPlan.date)
                          }
                          onSwipeableWillOpen={() =>
                            handleSwipeRemove(meal.id, dayPlan.date)
                          }
                          overshootRight={false}
                          friction={2}
                        >
                          <View className="bg-soft-beige rounded-2xl px-4 py-3 mb-2">
                            <Text className="text-charcoal font-medium">
                              {meal.name}
                            </Text>
                          </View>
                        </Swipeable>
                      ))}
                    </View>
                  )}

                  {/* Add Meal button - always visible */}
                  <TouchableOpacity
                    onPress={() => handleAddMeal(dayPlan.date)}
                    className="border-2 border-dashed border-warm-sand rounded-2xl px-4 py-3 flex-row items-center justify-center mt-2"
                  >
                    <Plus size={18} color="#3E3E3E" />
                    <Text className="text-charcoal/70 font-medium ml-2">
                      Add meal
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Add Meal Modal */}
        <Modal
          visible={showAddMealModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowAddMealModal(false);
            setShowRecipePicker(false);
            setCustomMealName("");
            setRecipeSearchQuery("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <Pressable
              className="flex-1 bg-black/50 justify-end"
              onPress={() => {
                setShowAddMealModal(false);
                setShowRecipePicker(false);
                setCustomMealName("");
                setRecipeSearchQuery("");
              }}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className="bg-off-white rounded-t-3xl p-6 max-h-[80%]"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-2xl font-bold text-charcoal">
                    Add Meal
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddMealModal(false);
                      setShowRecipePicker(false);
                      setCustomMealName("");
                      setRecipeSearchQuery("");
                    }}
                  >
                    <X size={24} color="#3E3E3E" />
                  </TouchableOpacity>
                </View>

                {!showRecipePicker ? (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View className="gap-4 pb-4">
                      <TouchableOpacity
                        onPress={() => setShowRecipePicker(true)}
                        className="bg-dark-sage rounded-2xl px-6 py-4 items-center"
                      >
                        <Text className="text-white font-semibold text-lg">
                          Choose from Recipes
                        </Text>
                      </TouchableOpacity>

                      <View className="flex-row items-center gap-3 my-2">
                        <View className="flex-1 h-px bg-warm-sand/30" />
                        <Text className="text-charcoal/60 text-sm">or</Text>
                        <View className="flex-1 h-px bg-warm-sand/30" />
                      </View>

                      <TextInput
                        placeholder="Type meal name..."
                        placeholderTextColor="#9CA3AF"
                        value={customMealName}
                        onChangeText={setCustomMealName}
                        className="bg-soft-beige rounded-2xl px-4 py-4 text-charcoal text-base"
                        autoFocus
                      />

                      <TouchableOpacity
                        onPress={handleSaveMeal}
                        disabled={!customMealName.trim()}
                        className={`rounded-2xl px-6 py-4 items-center ${
                          customMealName.trim()
                            ? "bg-dark-sage"
                            : "bg-warm-sand/30"
                        }`}
                      >
                        <Text
                          className={`font-semibold text-lg ${
                            customMealName.trim()
                              ? "text-white"
                              : "text-charcoal/40"
                          }`}
                        >
                          Add Custom Meal
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                ) : (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View className="flex-1">
                      <TouchableOpacity
                        onPress={() => {
                          setShowRecipePicker(false);
                          setRecipeSearchQuery("");
                        }}
                        className="mb-4"
                      >
                        <Text className="text-dark-sage font-medium">
                          ← Back
                        </Text>
                      </TouchableOpacity>

                      {/* Search Input */}
                      <View className="mb-4">
                        <View className="bg-soft-beige rounded-2xl px-4 py-3 flex-row items-center">
                          <Search size={20} color="#9CA3AF" />
                          <TextInput
                            placeholder="Search recipes..."
                            placeholderTextColor="#9CA3AF"
                            value={recipeSearchQuery}
                            onChangeText={setRecipeSearchQuery}
                            className="flex-1 ml-3 text-charcoal text-base"
                            autoFocus
                          />
                        </View>
                      </View>

                      <ScrollView
                        className="flex-1"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {filteredRecipes.length === 0 ? (
                          <View className="items-center justify-center py-8">
                            <Text className="text-charcoal/60 text-center">
                              {recipes.length === 0
                                ? "No recipes available. Add some recipes first!"
                                : `No recipes found matching "${recipeSearchQuery}"`}
                            </Text>
                          </View>
                        ) : (
                          filteredRecipes.map((recipe) => (
                            <TouchableOpacity
                              key={recipe.id}
                              onPress={() => handleAddRecipe(recipe.id)}
                              className="bg-soft-beige rounded-2xl px-4 py-3 mb-3 flex-row items-center"
                            >
                              <Image
                                source={{ uri: recipe.coverImage }}
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 12,
                                }}
                                contentFit="cover"
                                transition={200}
                                placeholder={{
                                  blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
                                }}
                              />
                              <Text className="text-charcoal font-medium ml-3 flex-1">
                                {recipe.title}
                              </Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

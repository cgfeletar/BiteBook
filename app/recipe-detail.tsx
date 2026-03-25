import { AuthPromptModal } from "@/components/AuthPromptModal";
import { IngredientTab } from "@/components/recipe-detail/IngredientTab";
import { InstructionTab } from "@/components/recipe-detail/InstructionTab";
import { RecipeHeader } from "@/components/recipe-detail/RecipeHeader";
import { RecipeInfoCards, StarRating } from "@/components/recipe-detail/RecipeInfoCards";
import {
  BookSelectorModal,
  MenuModal,
  TimerExtensionModal,
} from "@/components/recipe-detail/RecipeModals";
import { TagsSection } from "@/components/recipe-detail/TagsSection";
import { useRecipeTimers } from "@/src/hooks/useRecipeTimers";
import { useToast } from "@/src/hooks/useToast";
import { generateNutritionalInfo } from "@/src/services/recipeService";
import { useAuthStore } from "@/src/store/useAuthStore";
import { usePantryStore } from "@/src/store/usePantryStore";
import { useProgressStore } from "@/src/store/useProgressStore";
import { useRecipeBooksStore } from "@/src/store/useRecipeBooksStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";
import { Ingredient, Recipe, RecipeCreateInput, Step } from "@/src/types";
import {
  combineIngredients,
  detectKitchenware,
  HEADER_HEIGHT,
} from "@/src/utils/recipeDetailUtils";
import {
  isNutritionIncomplete,
  mergeNutrition,
  normalizeNutrition,
} from "@/src/utils/normalizeNutrition";
import { Bookmark, Link as LinkIcon } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Share,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

type TabType = "ingredients" | "instructions";

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();

  // ── Store selectors ──
  const addItemsToShoppingList = useShoppingListStore((s) => s.addItems);
  const shoppingItems = useShoppingListStore((s) => s.items);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const deleteRecipe = useRecipeStore((s) => s.deleteRecipe);
  const getRecipe = useRecipeStore((s) => s.getRecipe);
  const books = useRecipeBooksStore((s) => s.books);
  const addRecipeToBook = useRecipeBooksStore((s) => s.addRecipeToBook);
  const addRecipe = useRecipeBooksStore((s) => s.addRecipe);
  const pantryItems = usePantryStore((s) => s.items);
  const addPantryItem = usePantryStore((s) => s.addItem);
  const deletePantryItem = usePantryStore((s) => s.deleteItem);
  const addCookingSession = useProgressStore((s) => s.addCookingSession);
  const user = useAuthStore((s) => s.user);

  // ── Local state ──
  const [recipeData, setRecipeData] = useState<RecipeCreateInput | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("ingredients");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    new Set()
  );
  const [notes, setNotes] = useState("");
  const [viewByServing, setViewByServing] = useState(true);
  const [servings, setServings] = useState(4);
  const [recipeScale, setRecipeScale] = useState<1 | 1.5 | 2 | 3>(1);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false);
  const [isEditingIngredients, setIsEditingIngredients] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [editedSteps, setEditedSteps] = useState<Step[]>([]);
  const isImported = params.isImported === "true";

  // ── Custom hooks ──
  const { toastMessage, showToast, toastAnimatedStyle } = useToast();
  const timers = useRecipeTimers(recipeData?.steps);
  const scrollY = useSharedValue(0);

  // ── Derived data ──
  const isEmptyRecipe = useMemo(() => {
    if (!recipeData) return false;
    const hasNoIngredients =
      !recipeData.ingredients || recipeData.ingredients.length === 0;
    const hasNoInstructions =
      !recipeData.steps || recipeData.steps.length === 0;
    return hasNoIngredients && hasNoInstructions;
  }, [recipeData]);

  const combinedIngredients = useMemo(
    () =>
      recipeData?.ingredients
        ? combineIngredients(recipeData.ingredients)
        : [],
    [recipeData?.ingredients]
  );

  const kitchenware = useMemo(
    () =>
      recipeData
        ? detectKitchenware(recipeData.ingredients || [], recipeData.steps || [])
        : [],
    [recipeData]
  );

  const recipeId = useMemo((): string | undefined => {
    if (
      recipeData &&
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      return recipeData.id;
    }
    if (params.id && typeof params.id === "string") return params.id;
    return undefined;
  }, [recipeData, params.id]);

  const shoppingListStatus = useMemo(() => {
    if (!recipeId) return { hasAdded: false };
    const recipeShoppingItems = shoppingItems.filter(
      (item) => item.originalRecipeId === recipeId
    );
    const hasUnpurchasedItems = recipeShoppingItems.some(
      (item) => !item.isPurchased
    );
    return { hasAdded: recipeShoppingItems.length > 0 && hasUnpurchasedItems };
  }, [recipeId, shoppingItems]);

  const customTags =
    recipeData?.tags?.filter((tag) => !originalTags.includes(tag)) || [];

  const canEditRecipe = (): boolean => {
    if (!recipeData) return false;
    if (!("id" in recipeData)) return false;
    const id = recipeData.id;
    return id !== null && id !== undefined && typeof id === "string";
  };

  // ── Effects ──
  useEffect(() => {
    const dataParam = params.importedData || params.recipeData;
    if (dataParam) {
      try {
        const parsed = JSON.parse(dataParam as string) as
          | Recipe
          | RecipeCreateInput;
        const limitedTitle = parsed.title
          ? parsed.title.slice(0, 40)
          : parsed.title;
        setRecipeData({
          ...parsed,
          title: limitedTitle,
          coverImage: parsed.coverImage || "",
        });

        if (params.missingFields) {
          try {
            const missing = JSON.parse(params.missingFields as string);
            if (Array.isArray(missing)) setMissingFields(missing);
          } catch {
            // ignore parse error
          }
        }

        if (parsed.tags && parsed.tags.length > 0) {
          setOriginalTags([...parsed.tags]);
        } else {
          setOriginalTags([]);
        }

        if ("id" in parsed && parsed.id) {
          const storedRecipe = getRecipe(parsed.id);
          if (storedRecipe) {
            setRecipeData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                coverImage: prev.coverImage || storedRecipe.coverImage || "",
                rating: storedRecipe.rating || prev.rating,
              };
            });
          }
          if (storedRecipe?.tags && storedRecipe.tags.length > 0) {
            setOriginalTags((prev) =>
              prev.length === 0 ? [...storedRecipe.tags] : prev
            );
          }
        }
      } catch {
        // ignore parse error
      }
    }
  }, [params.importedData, params.recipeData, getRecipe]);

  // Auto-generate nutrition if incomplete
  const hasGeneratedNutrition = useRef<string | null>(null);
  useEffect(() => {
    const checkAndGenerateNutrition = async () => {
      if (!recipeData) return;
      if (hasGeneratedNutrition.current === recipeData.id) return;

      const nutritionIncomplete = isNutritionIncomplete(
        recipeData.nutritionalInfo
      );
      if (
        nutritionIncomplete &&
        recipeData.ingredients &&
        recipeData.ingredients.length > 0
      ) {
        hasGeneratedNutrition.current = recipeData.id;
        setIsLoadingNutrition(true);
        try {
          const generatedNutrition = await generateNutritionalInfo(
            recipeData.ingredients
          );
          const mergedNutrition = mergeNutrition(
            recipeData.nutritionalInfo,
            generatedNutrition
          );
          const finalNutrition = normalizeNutrition(mergedNutrition);

          setRecipeData((prev) =>
            prev ? { ...prev, nutritionalInfo: finalNutrition } : prev
          );

          if (recipeData.id && user?.defaultKitchenId) {
            updateRecipe(
              recipeData.id,
              { nutritionalInfo: finalNutrition },
              user.defaultKitchenId
            );
          }
        } catch {
          hasGeneratedNutrition.current = null;
        } finally {
          setIsLoadingNutrition(false);
        }
      }
    };
    checkAndGenerateNutrition();
  }, [recipeData, user?.defaultKitchenId, updateRecipe]);

  // ── Handlers ──
  const handleShare = async () => {
    if (!recipeData) return;
    try {
      const titleToShare = (recipeData.title || "Untitled Recipe").slice(0, 40);
      await Share.share({
        message: `${titleToShare}\n\n${recipeData.sourceUrl || ""}`,
        title: titleToShare,
      });
      setShowMenu(false);
    } catch {
      // ignore share error
    }
  };

  const handleAddToCalendar = () => {
    setShowMenu(false);
    const id = params.id as string;
    if (id) {
      router.push(`/(tabs)/meal-plan?recipeId=${id}`);
    } else {
      router.push("/(tabs)/meal-plan");
    }
  };

  const handleAddToBook = (bookId: string) => {
    if (!recipeData) return;
    const recipe: Recipe = {
      id: `recipe-${Date.now()}-${Math.random()}`,
      title: recipeData.title,
      coverImage: recipeData.coverImage,
      ingredients: recipeData.ingredients,
      steps: recipeData.steps,
      nutritionalInfo: recipeData.nutritionalInfo,
      sourceUrl: recipeData.sourceUrl,
      originalAuthor: recipeData.originalAuthor,
      tags: recipeData.tags,
      categoryIds: recipeData.categoryIds,
      createdAt: new Date(),
    };
    addRecipe(recipe);
    addRecipeToBook(bookId, recipe.id, recipe.coverImage);
    Alert.alert("Success", "Recipe added to book!");
    setShowBookSelector(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (!recipeData) return;
    let id: string | null = null;
    if ("id" in recipeData && recipeData.id) {
      id =
        typeof recipeData.id === "string"
          ? recipeData.id
          : String(recipeData.id);
    }
    if (!id) {
      Alert.alert(
        "Cannot Delete",
        "This recipe hasn't been saved yet. Only saved recipes can be deleted."
      );
      setShowMenu(false);
      return;
    }
    Alert.alert(
      "Delete Recipe",
      `Are you sure you want to delete "${(
        recipeData.title || "Untitled Recipe"
      ).slice(0, 40)}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setShowMenu(false) },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteRecipe(id as string, user?.defaultKitchenId);
            setShowMenu(false);
            router.back();
          },
        },
      ]
    );
  };

  const handleStartEditTitle = () => {
    if (!recipeData) return;
    setEditedTitle((recipeData.title || "Untitled Recipe").slice(0, 40));
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (!recipeData || !canEditRecipe()) {
      setIsEditingTitle(false);
      return;
    }
    const trimmedTitle = editedTitle.trim().slice(0, 40);
    if (!trimmedTitle) {
      Alert.alert("Error", "Recipe title cannot be empty.");
      return;
    }
    if (
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      updateRecipe(recipeData.id, { title: trimmedTitle }, user?.defaultKitchenId);
    }
    setRecipeData({ ...recipeData, title: trimmedTitle });
    setIsEditingTitle(false);
  };

  const handleRate = (star: number) => {
    if (!recipeData) return;
    const newRating = recipeData.rating === star ? undefined : star;
    setRecipeData((prev) => (prev ? { ...prev, rating: newRating } : null));
    if ("id" in recipeData && typeof recipeData.id === "string") {
      const storedRecipe = getRecipe(recipeData.id);
      if (storedRecipe) {
        updateRecipe(storedRecipe.id, { rating: newRating }, user?.defaultKitchenId);
      }
    }
  };

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  // Ingredient editing
  const handleStartEditIngredients = () => {
    if (!recipeData || !canEditRecipe()) {
      Alert.alert(
        "Cannot Edit",
        "This recipe hasn't been saved yet. Please save the recipe first before editing."
      );
      return;
    }
    setEditedIngredients([...recipeData.ingredients]);
    setIsEditingIngredients(true);
  };

  const handleSaveIngredients = () => {
    if (!recipeData || !canEditRecipe()) return;
    if (
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      updateRecipe(
        recipeData.id,
        { ingredients: editedIngredients },
        user?.defaultKitchenId
      );
      setRecipeData({ ...recipeData, ingredients: editedIngredients });
      setIsEditingIngredients(false);
    }
  };

  const handleUpdateIngredient = (
    index: number,
    field: keyof Ingredient,
    value: string | number | null
  ) => {
    const updated = [...editedIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditedIngredients(updated);
  };

  // Instruction editing
  const handleStartEditInstructions = () => {
    if (!recipeData || !canEditRecipe()) {
      Alert.alert(
        "Cannot Edit",
        "This recipe hasn't been saved yet. Please save the recipe first before editing."
      );
      return;
    }
    setEditedSteps([...recipeData.steps]);
    setIsEditingInstructions(true);
  };

  const handleSaveInstructions = () => {
    if (!recipeData || !canEditRecipe()) return;
    if (
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      updateRecipe(recipeData.id, { steps: editedSteps }, user?.defaultKitchenId);
      setRecipeData({ ...recipeData, steps: editedSteps });
      setIsEditingInstructions(false);
    }
  };

  const handleUpdateStep = (
    stepId: string,
    field: keyof Step,
    value: string | number | boolean | undefined
  ) => {
    setEditedSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step
      )
    );
  };

  // Pantry & ingredient interactions
  const handleIngredientCheck = (name: string, ingredient: Ingredient) => {
    const normalizedName = name.toLowerCase().trim();
    setCheckedIngredients((prev) => {
      const newSet = new Set(prev);
      const isChecked = Array.from(newSet).some(
        (checked) => checked.toLowerCase().trim() === normalizedName
      );
      if (isChecked) {
        Array.from(newSet).forEach((checked) => {
          if (checked.toLowerCase().trim() === normalizedName)
            newSet.delete(checked);
        });
      } else {
        newSet.add(name);
        const alreadyInPantry = pantryItems.some(
          (item) => item.name.toLowerCase().trim() === normalizedName
        );
        if (!alreadyInPantry && ingredient.quantity !== null) {
          addPantryItem({
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        }
        const shoppingItem = shoppingItems.find(
          (item) => item.name.toLowerCase().trim() === normalizedName
        );
        if (shoppingItem) {
          useShoppingListStore.getState().deleteItem(shoppingItem.id);
        }
      }
      return newSet;
    });
  };

  const handleAddToShoppingList = () => {
    if (!recipeData) return;
    const originalIngredientsToBuy =
      recipeData.ingredients?.filter((ing) => {
        const normalizedName = ing.name.toLowerCase().trim();
        const isInPantry = pantryItems.some(
          (item) => item.name.toLowerCase().trim() === normalizedName
        );
        const isChecked = Array.from(checkedIngredients).some(
          (checked) => checked.toLowerCase().trim() === normalizedName
        );
        return !isInPantry && !isChecked;
      }) || [];
    addItemsToShoppingList(
      originalIngredientsToBuy,
      recipeId,
      user?.defaultKitchenId
    );
  };

  const handleAddToPantry = (ingredient: Ingredient) => {
    addPantryItem({
      name: ingredient.name,
      quantity: ingredient.quantity || 1,
      unit: ingredient.unit || "item",
    });
  };

  const handleRemoveFromPantry = (ingredientName: string) => {
    const pantryItem = pantryItems.find(
      (item) =>
        item.name.toLowerCase().trim() ===
        ingredientName.toLowerCase().trim()
    );
    if (pantryItem) deletePantryItem(pantryItem.id);
  };

  const handleUncheckIngredient = (ingredientName: string) => {
    setCheckedIngredients((prev) => {
      const newSet = new Set(prev);
      newSet.delete(ingredientName);
      return newSet;
    });
  };

  // Tags
  const handleAddCustomTag = (tag: string) => {
    if (!recipeData) return;
    const currentTags = recipeData.tags || [];
    if (currentTags.includes(tag)) return;
    const updatedTags = [...currentTags, tag];
    setRecipeData({ ...recipeData, tags: updatedTags });
    if (
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      updateRecipe(recipeData.id, { tags: updatedTags }, user?.defaultKitchenId);
    }
  };

  const handleRemoveCustomTag = (tag: string) => {
    if (!recipeData) return;
    const updatedTags = recipeData.tags.filter((t) => t !== tag);
    setRecipeData({ ...recipeData, tags: updatedTags });
    if (
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      updateRecipe(recipeData.id, { tags: updatedTags }, user?.defaultKitchenId);
    }
  };

  // Mark as cooked
  const handleMarkAsCooked = () => {
    if (!recipeData) return;
    let cookRecipeId: string | null = null;
    if ("id" in recipeData && recipeData.id && typeof recipeData.id === "string") {
      cookRecipeId = recipeData.id;
    }
    if (!cookRecipeId) {
      const dataParam = params.importedData || params.recipeData;
      if (dataParam) {
        try {
          const parsed = JSON.parse(dataParam as string) as Recipe | RecipeCreateInput;
          cookRecipeId = "id" in parsed && parsed.id ? parsed.id : null;
        } catch {
          // ignore
        }
      }
    }
    if (!cookRecipeId) {
      Alert.alert(
        "Error",
        "Unable to mark recipe as cooked. Recipe ID not found."
      );
      return;
    }
    const prepTime = recipeData.prepTime || 0;
    const cookTime =
      recipeData.steps?.reduce(
        (sum, step) => sum + (step.timerDuration || 0),
        0
      ) || 0;
    const totalTimeMinutes = prepTime + Math.floor(cookTime / 60);
    addCookingSession(cookRecipeId, totalTimeMinutes);
    Alert.alert(
      "Recipe Marked as Cooked!",
      "This recipe has been added to your cooking history.",
      [{ text: "OK" }]
    );
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ── Loading state ──
  if (!recipeData) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-charcoal-gray text-base">
              Loading recipe...
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // ── Render ──
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-off-white">
        <RecipeHeader
          recipeData={recipeData}
          scrollY={scrollY}
          missingFields={missingFields}
          isEditingTitle={isEditingTitle}
          editedTitle={editedTitle}
          onEditedTitleChange={setEditedTitle}
          onStartEditTitle={handleStartEditTitle}
          onSaveTitle={handleSaveTitle}
          onCancelEditTitle={() => {
            setIsEditingTitle(false);
            setEditedTitle("");
          }}
          onMenuPress={() => setShowMenu(true)}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop: HEADER_HEIGHT,
              paddingBottom: 24,
            }}
          >
            {/* Content */}
            <View className="px-6 pt-6 pb-8">
              {/* Imported Notice */}
              {isImported && (
                <View className="bg-dark-sage/20 rounded-xl p-4 mb-6">
                  <Text className="text-dark-sage font-semibold text-sm">
                    ✓ Recipe imported successfully! Review and save when ready.
                  </Text>
                </View>
              )}

              <RecipeInfoCards
                recipeData={recipeData}
                servings={servings}
                isEmptyRecipe={isEmptyRecipe}
              />

              <StarRating rating={recipeData.rating} onRate={handleRate} />

              {/* Empty Recipe State */}
              {isEmptyRecipe && (
                <View className="items-center py-8">
                  <View className="bg-soft-beige rounded-full p-6 mb-6">
                    <Bookmark size={48} color="#5A6E6C" />
                  </View>
                  <Text
                    className="text-xl font-bold text-charcoal-gray mb-3 text-center"
                    style={{ fontFamily: "Lora_700Bold" }}
                  >
                    Saved Link
                  </Text>
                  <Text className="text-base text-charcoal-gray/70 text-center mb-8 px-4">
                    No recipe details were found at this link, but you can still
                    keep it saved for later reference.
                  </Text>
                  {recipeData?.sourceUrl && (
                    <RNTouchableOpacity
                      onPress={async () => {
                        try {
                          const canOpen = await Linking.canOpenURL(
                            recipeData.sourceUrl
                          );
                          if (canOpen) await Linking.openURL(recipeData.sourceUrl);
                        } catch {
                          Alert.alert("Error", "Could not open the link");
                        }
                      }}
                      className="bg-dark-sage rounded-2xl px-8 py-4 flex-row items-center justify-center mb-4"
                      activeOpacity={0.8}
                      style={{ minWidth: 200 }}
                    >
                      <LinkIcon
                        size={20}
                        color="#FAF9F7"
                        style={{ marginRight: 10 }}
                      />
                      <Text className="text-off-white text-base font-semibold">
                        Visit Original Link
                      </Text>
                    </RNTouchableOpacity>
                  )}
                </View>
              )}

              {/* Missing Fields Warning */}
              {!isEmptyRecipe && missingFields.length > 0 && (
                <View className="mb-4 bg-dusty-rose/20 border-2 border-dusty-rose rounded-xl p-4">
                  <View className="flex-row items-start">
                    <Text className="text-dusty-rose text-lg mr-2">⚠️</Text>
                    <View className="flex-1">
                      <Text className="text-charcoal-gray font-semibold mb-1">
                        Some fields are missing
                      </Text>
                      <Text className="text-charcoal-gray/70 text-sm">
                        The following fields could not be extracted from the
                        image: {missingFields.join(", ")}. Please review and
                        edit the recipe.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Segmented Control */}
              {!isEmptyRecipe && (
                <View className="flex-row bg-soft-beige rounded-xl p-1 mb-4">
                  <RNTouchableOpacity
                    onPress={() => setActiveTab("ingredients")}
                    className={`flex-1 py-3 rounded-lg items-center ${
                      activeTab === "ingredients" ? "bg-dark-sage" : ""
                    }`}
                    activeOpacity={0.7}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <View className="flex-row items-center">
                      <Text
                        className={`font-semibold ${
                          activeTab === "ingredients"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Ingredients
                      </Text>
                      {missingFields.includes("ingredients") && (
                        <Text className="text-dusty-rose ml-1">⚠️</Text>
                      )}
                    </View>
                  </RNTouchableOpacity>
                  <RNTouchableOpacity
                    onPress={() => setActiveTab("instructions")}
                    className={`flex-1 py-3 rounded-lg items-center ${
                      activeTab === "instructions" ? "bg-dark-sage" : ""
                    }`}
                    activeOpacity={0.7}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <View className="flex-row items-center">
                      <Text
                        className={`font-semibold ${
                          activeTab === "instructions"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Instructions
                      </Text>
                      {missingFields.includes("steps") && (
                        <Text className="text-dusty-rose ml-1">⚠️</Text>
                      )}
                    </View>
                  </RNTouchableOpacity>
                </View>
              )}

              {/* Ingredients Tab */}
              {!isEmptyRecipe && activeTab === "ingredients" && (
                <IngredientTab
                  ingredients={recipeData.ingredients}
                  combinedIngredients={combinedIngredients}
                  missingFields={missingFields}
                  recipeScale={recipeScale}
                  onScaleChange={setRecipeScale}
                  pantryItems={pantryItems}
                  shoppingItems={shoppingItems}
                  checkedIngredients={checkedIngredients}
                  onIngredientCheck={handleIngredientCheck}
                  onAddToShoppingList={handleAddToShoppingList}
                  shoppingListHasAdded={shoppingListStatus.hasAdded}
                  onAddToPantry={handleAddToPantry}
                  onRemoveFromPantry={handleRemoveFromPantry}
                  onUncheckIngredient={handleUncheckIngredient}
                  onShowToast={showToast}
                  canEdit={canEditRecipe()}
                  isEditing={isEditingIngredients}
                  editedIngredients={editedIngredients}
                  onStartEdit={handleStartEditIngredients}
                  onSaveEdit={handleSaveIngredients}
                  onCancelEdit={() => {
                    setIsEditingIngredients(false);
                    setEditedIngredients([]);
                  }}
                  onAddIngredient={() =>
                    setEditedIngredients([
                      ...editedIngredients,
                      { name: "", quantity: null, unit: "", isChecked: false },
                    ])
                  }
                  onDeleteIngredient={(index) =>
                    setEditedIngredients(
                      editedIngredients.filter((_, i) => i !== index)
                    )
                  }
                  onUpdateIngredient={handleUpdateIngredient}
                  kitchenware={kitchenware}
                  nutritionalInfo={recipeData.nutritionalInfo}
                  isLoadingNutrition={isLoadingNutrition}
                  servings={servings}
                  viewByServing={viewByServing}
                  onToggleNutritionView={setViewByServing}
                />
              )}

              {/* Instructions Tab */}
              {!isEmptyRecipe && activeTab === "instructions" && (
                <InstructionTab
                  recipeData={recipeData}
                  missingFields={missingFields}
                  completedSteps={completedSteps}
                  onStepComplete={handleStepComplete}
                  timerStates={timers.timerStates}
                  onStartTimer={timers.startTimer}
                  onPauseTimer={timers.pauseTimer}
                  onResumeTimer={timers.resumeTimer}
                  onResetTimer={timers.resetTimer}
                  onDismissTimer={timers.dismissTimer}
                  onOpenTimerExtension={timers.setTimerExtensionStepId}
                  canEdit={canEditRecipe()}
                  isEditing={isEditingInstructions}
                  editedSteps={editedSteps}
                  onStartEdit={handleStartEditInstructions}
                  onSaveEdit={handleSaveInstructions}
                  onCancelEdit={() => {
                    setIsEditingInstructions(false);
                    setEditedSteps([]);
                  }}
                  onAddStep={() =>
                    setEditedSteps([
                      ...editedSteps,
                      {
                        id: `step-${Date.now()}-${Math.random()
                          .toString(36)
                          .substr(2, 9)}`,
                        instruction: "",
                        isCompleted: false,
                        isBeginnerFriendly: true,
                      },
                    ])
                  }
                  onDeleteStep={(stepId) =>
                    setEditedSteps(
                      editedSteps.filter((step) => step.id !== stepId)
                    )
                  }
                  onUpdateStep={handleUpdateStep}
                  onMarkAsCooked={handleMarkAsCooked}
                />
              )}

              {/* Notes Section */}
              {activeTab === "instructions" && (
                <View className="mt-6 mb-6">
                  <Text className="text-2xl font-bold text-charcoal-gray mb-4">
                    Notes
                  </Text>
                  <TextInput
                    className="bg-soft-beige rounded-xl px-4 py-4 text-charcoal-gray text-base min-h-[120px]"
                    placeholder="Add your notes, substitutions, or tips here..."
                    placeholderTextColor="#9CA3AF"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 120 }}
                  />
                </View>
              )}

              {/* Tags */}
              <TagsSection
                originalTags={originalTags}
                customTags={customTags}
                onRemoveCustomTag={handleRemoveCustomTag}
                onAddCustomTag={handleAddCustomTag}
              />

              {/* Save Button (for imported recipes) */}
              {isImported && (
                <RNTouchableOpacity
                  className="bg-dark-sage rounded-xl py-4 items-center justify-center mb-8"
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!user) {
                      setShowAuthPrompt(true);
                      return;
                    }
                    Alert.alert("Success", "Recipe saved!");
                  }}
                  style={{ minHeight: 44 }}
                >
                  <Text className="text-off-white text-base font-semibold">
                    Save Recipe
                  </Text>
                </RNTouchableOpacity>
              )}
            </View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        {/* Modals */}
        <MenuModal
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          onShare={handleShare}
          onAddToCalendar={handleAddToCalendar}
          onDelete={handleDelete}
        />

        <BookSelectorModal
          visible={showBookSelector}
          onClose={() => setShowBookSelector(false)}
          books={books}
          onSelectBook={handleAddToBook}
        />
      </View>

      <AuthPromptModal
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onSuccess={() => {
          if (isImported && recipeData) {
            Alert.alert("Success", "Recipe saved!");
          }
        }}
        message="Please sign in to save recipes"
      />

      <TimerExtensionModal
        visible={timers.timerExtensionStepId !== null}
        customMinutes={timers.customMinutes}
        onCustomMinutesChange={timers.setCustomMinutes}
        onConfirm={timers.handleCustomTimeExtension}
        onClose={timers.closeTimerExtension}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 100,
              left: 24,
              right: 24,
              zIndex: 9999,
            },
            toastAnimatedStyle,
          ]}
          pointerEvents="none"
        >
          <View className="bg-dark-sage rounded-xl px-6 py-4 shadow-lg">
            <Text className="text-off-white text-base font-semibold text-center">
              {toastMessage}
            </Text>
          </View>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

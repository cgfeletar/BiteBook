import { AuthPromptModal } from "@/components/AuthPromptModal";
import { generateNutritionalInfo } from "@/src/services/recipeService";
import { isNutritionIncomplete, mergeNutrition, normalizeNutrition } from "@/src/utils/normalizeNutrition";
import { useAuthStore } from "@/src/store/useAuthStore";
import { usePantryStore } from "@/src/store/usePantryStore";
import { useProgressStore } from "@/src/store/useProgressStore";
import { useRecipeBooksStore } from "@/src/store/useRecipeBooksStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";
import { Ingredient, Recipe, RecipeCreateInput, Step } from "@/src/types";
import { formatDecimal, formatQuantity } from "@/src/utils/fractionFormatter";
import { decodeHtmlEntities } from "@/src/utils/htmlDecoder";
import { Image } from "expo-image";
import * as Notifications from "expo-notifications";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MoreVertical,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Share2,
  ShoppingBag,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  TouchableOpacity as RNTouchableOpacity,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const HEADER_HEIGHT = 300;
const MIN_HEADER_HEIGHT = 100;

type TabType = "ingredients" | "instructions";

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const [recipeData, setRecipeData] = useState<RecipeCreateInput | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("ingredients");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [useMetric, setUseMetric] = useState(false); // true = grams, false = cups
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    new Set()
  );
  const [notes, setNotes] = useState("");
  const [viewByServing, setViewByServing] = useState(true); // true = by serving, false = whole recipe
  const [servings, setServings] = useState(4); // Default servings
  const [recipeScale, setRecipeScale] = useState<1 | 1.5 | 2 | 3>(1);
  const [newTag, setNewTag] = useState("");
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const addItemsToShoppingList = useShoppingListStore(
    (state) => state.addItems
  );
  const deleteShoppingItem = useShoppingListStore((state) => state.deleteItem);
  const shoppingItems = useShoppingListStore((state) => state.items);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const getRecipe = useRecipeStore((state) => state.getRecipe);
  const books = useRecipeBooksStore((state) => state.books);
  const addRecipeToBook = useRecipeBooksStore((state) => state.addRecipeToBook);
  const addRecipe = useRecipeBooksStore((state) => state.addRecipe);
  const pantryItems = usePantryStore((state) => state.items);
  const addPantryItem = usePantryStore((state) => state.addItem);
  const deletePantryItem = usePantryStore((state) => state.deleteItem);
  const addCookingSession = useProgressStore(
    (state) => state.addCookingSession
  );
  const user = useAuthStore((state) => state.user);
  const [showMenu, setShowMenu] = useState(false);
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showScaleDropdown, setShowScaleDropdown] = useState(false);
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [showKitchenware, setShowKitchenware] = useState(false);
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false);
  const [isEditingIngredients, setIsEditingIngredients] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [editedSteps, setEditedSteps] = useState<Step[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isImported = params.isImported === "true";

  // Toast animation shared values
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(100);

  // Toast animation
  useEffect(() => {
    if (toastMessage) {
      // Show toast
      toastOpacity.value = withTiming(1, { duration: 300 });
      toastTranslateY.value = withTiming(0, { duration: 300 });
      // Hide toast after 2 seconds
      setTimeout(() => {
        toastOpacity.value = withTiming(0, { duration: 300 });
        toastTranslateY.value = withTiming(100, { duration: 300 });
        setTimeout(() => setToastMessage(null), 300);
      }, 2000);
    }
  }, [toastMessage, toastOpacity, toastTranslateY]);

  const toastAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: toastOpacity.value,
      transform: [{ translateY: toastTranslateY.value }],
    };
  });

  // Timer states for each step
  const [timerStates, setTimerStates] = useState<
    Record<
      string,
      {
        remaining: number; // in seconds
        isRunning: boolean;
        isCompleted: boolean;
        isDismissed?: boolean;
      }
    >
  >({});

  const timerIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>(
    {}
  );

  // State for timer extension UI
  const [timerExtensionStepId, setTimerExtensionStepId] = useState<
    string | null
  >(null);
  const [customMinutes, setCustomMinutes] = useState<string>("");

  // Refs for Swipeable components to programmatically close them
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  /**
   * Extract kitchenware needed from ingredients and instructions
   */
  const kitchenware = useMemo(() => {
    if (!recipeData) return [];

    const kitchenwareSet = new Set<string>();

    const allText = [
      ...(recipeData.ingredients || []).map((ing) => ing.name),
      ...(recipeData.steps || []).map((step) => step.instruction),
    ]
      .join(" ")
      .toLowerCase();

    // Kitchenware keywords and their display names
    const kitchenwareKeywords: Record<string, string> = {
      // Mixing & Blending
      "stand mixer": "Stand Mixer",
      "hand mixer": "Hand Mixer",
      "electric mixer": "Electric Mixer",
      mixer: "Mixer",
      blender: "Blender",
      "immersion blender": "Immersion Blender",
      "food processor": "Food Processor",
      whisk: "Whisk",
      "rubber spatula": "Rubber Spatula",
      spatula: "Spatula",
      "wooden spoon": "Wooden Spoon",
      "mixing bowl": "Mixing Bowl",
      "large bowl": "Large Bowl",
      "medium bowl": "Medium Bowl",
      "small bowl": "Small Bowl",
      bowl: "Bowl",

      // Measuring
      "measuring cup": "Measuring Cups",
      "measuring cups": "Measuring Cups",
      "measuring spoon": "Measuring Spoons",
      "measuring spoons": "Measuring Spoons",
      "liquid measuring cup": "Liquid Measuring Cup",
      "dry measuring cup": "Dry Measuring Cups",
      "kitchen scale": "Kitchen Scale",
      scale: "Kitchen Scale",

      // Baking
      "baking sheet": "Baking Sheet",
      "sheet pan": "Baking Sheet",
      "parchment paper": "Parchment Paper",
      "baking dish": "Baking Dish",
      "cake pan": "Cake Pan",
      "muffin tin": "Muffin Tin",
      "loaf pan": "Loaf Pan",
      "pie dish": "Pie Dish",
      "springform pan": "Springform Pan",
      "bundt pan": "Bundt Pan",
      "rolling pin": "Rolling Pin",
      "pastry brush": "Pastry Brush",

      // Cooking
      "frying pan": "Frying Pan",
      skillet: "Skillet",
      saucepan: "Saucepan",
      pot: "Pot",
      "large pot": "Large Pot",
      "dutch oven": "Dutch Oven",
      stockpot: "Stockpot",
      wok: "Wok",
      griddle: "Griddle",
      "cast iron": "Cast Iron Skillet",
      "non-stick pan": "Non-Stick Pan",

      // Cutting & Prep
      "cutting board": "Cutting Board",
      "chef's knife": "Chef's Knife",
      "paring knife": "Paring Knife",
      "serrated knife": "Serrated Knife",
      "kitchen shears": "Kitchen Shears",
      peeler: "Vegetable Peeler",
      grater: "Grater",
      zester: "Zester",
      microplane: "Microplane",
      mandoline: "Mandoline",

      // Other Tools
      "can opener": "Can Opener",
      "bottle opener": "Bottle Opener",
      corkscrew: "Corkscrew",
      tongs: "Tongs",
      "slotted spoon": "Slotted Spoon",
      ladle: "Ladle",
      strainer: "Strainer",
      colander: "Colander",
      sieve: "Sieve",
      "fine mesh strainer": "Fine Mesh Strainer",
      "aluminum foil": "Aluminum Foil",
      "plastic wrap": "Plastic Wrap",
      "ziploc bag": "Ziploc Bag",
      parchment: "Parchment Paper",
      "wax paper": "Wax Paper",

      // Appliances
      "slow cooker": "Slow Cooker",
      "crock pot": "Slow Cooker",
      "instant pot": "Instant Pot",
      "pressure cooker": "Pressure Cooker",
      "air fryer": "Air Fryer",
      "rice cooker": "Rice Cooker",
      "toaster oven": "Toaster Oven",
      "food thermometer": "Food Thermometer",
      "meat thermometer": "Meat Thermometer",
    };

    // Detect kitchenware
    for (const [keyword, displayName] of Object.entries(kitchenwareKeywords)) {
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(allText)) {
        kitchenwareSet.add(displayName);
      }
    }

    // Always add basic items if recipe has ingredients
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      const hasVolumeUnits = recipeData.ingredients.some(
        (ing) =>
          ing.unit &&
          (ing.unit.toLowerCase().includes("cup") ||
            ing.unit.toLowerCase().includes("tablespoon") ||
            ing.unit.toLowerCase().includes("teaspoon") ||
            ing.unit.toLowerCase().includes("tbsp") ||
            ing.unit.toLowerCase().includes("tsp"))
      );

      if (hasVolumeUnits) {
        kitchenwareSet.add("Measuring Cups");
        kitchenwareSet.add("Measuring Spoons");
      }

      if (recipeData.ingredients.length > 2) {
        kitchenwareSet.add("Mixing Bowl");
      }
    }

    /**
     * 🔽 COMBINE / NORMALIZE STEP
     */
    const detected = Array.from(kitchenwareSet);

    const groups: { label: string; matches: string[] }[] = [
      {
        label: "Mixing Bowls",
        matches: [
          "Bowl",
          "Large Bowl",
          "Medium Bowl",
          "Small Bowl",
          "Mixing Bowl",
        ],
      },
      {
        label: "Electronic Mixer",
        matches: ["Stand Mixer", "Hand Mixer", "Mixer", "Electric Mixer"],
      },
    ];

    const finalSet = new Set<string>(detected);

    for (const group of groups) {
      const hasAny = group.matches.some((item) => finalSet.has(item));
      if (hasAny) {
        group.matches.forEach((item) => finalSet.delete(item));
        finalSet.add(group.label);
      }
    }

    return Array.from(finalSet).sort();
  }, [recipeData]);

  // Combine duplicate ingredients (same name and unit)
  const combinedIngredients = useMemo(() => {
    if (!recipeData || !recipeData.ingredients) {
      return [];
    }

    const ingredientMap = new Map<string, Ingredient>();

    recipeData.ingredients.forEach((ing) => {
      // Create a key from normalized name and unit
      // Handle null unit (for "to taste" ingredients)
      const unitKey = ing.unit ? ing.unit.toLowerCase().trim() : "";
      const key = `${ing.name.toLowerCase().trim()}|${unitKey}`;

      if (ingredientMap.has(key)) {
        // Combine with existing ingredient
        const existing = ingredientMap.get(key)!;
        // Handle null quantities (for "to taste" ingredients)
        const existingQty = existing.quantity ?? 0;
        const ingQty = ing.quantity ?? 0;
        ingredientMap.set(key, {
          ...existing,
          quantity: existingQty + ingQty,
        });
      } else {
        // Add new ingredient
        ingredientMap.set(key, { ...ing });
      }
    });

    return Array.from(ingredientMap.values());
  }, [recipeData?.ingredients]);

  // Get recipe ID for tracking shopping list items
  const recipeId = useMemo((): string | undefined => {
    if (
      recipeData &&
      "id" in recipeData &&
      recipeData.id &&
      typeof recipeData.id === "string"
    ) {
      return recipeData.id;
    }
    if (params.id && typeof params.id === "string") {
      return params.id;
    }
    return undefined;
  }, [recipeData, params.id]);

  // Check if ingredients from this recipe are in shopping list
  // Text should remain until items are deleted, checked off (purchased), or moved to pantry
  const shoppingListStatus = useMemo(() => {
    if (!recipeId) {
      return { hasAdded: false };
    }

    // Find all shopping list items that came from this recipe
    const recipeShoppingItems = shoppingItems.filter(
      (item) => item.originalRecipeId === recipeId
    );

    // Check if any items are still unpurchased (not checked off)
    // If all items are purchased, deleted, or moved to pantry, they won't be in the list
    const hasUnpurchasedItems = recipeShoppingItems.some(
      (item) => !item.isPurchased
    );

    return { hasAdded: recipeShoppingItems.length > 0 && hasUnpurchasedItems };
  }, [recipeId, shoppingItems]);

  // Split ingredients into two groups (considering both pantry and checked items)
  const { ingredientsInPantry, ingredientsToBuy } = useMemo(() => {
    if (!combinedIngredients || combinedIngredients.length === 0) {
      return { ingredientsInPantry: [], ingredientsToBuy: [] };
    }

    // Check if ingredient is in pantry
    const isIngredientInPantry = (ingredientName: string): boolean => {
      const normalizedName = ingredientName.toLowerCase().trim();
      return pantryItems.some(
        (item) => item.name.toLowerCase().trim() === normalizedName
      );
    };

    // Check if ingredient is checked off
    const isIngredientChecked = (ingredientName: string): boolean => {
      const normalizedName = ingredientName.toLowerCase().trim();
      return Array.from(checkedIngredients).some(
        (checked) => checked.toLowerCase().trim() === normalizedName
      );
    };

    const inPantry: Ingredient[] = [];
    const toBuy: Ingredient[] = [];

    combinedIngredients.forEach((ing) => {
      // Item is in pantry OR has been checked off
      if (isIngredientInPantry(ing.name) || isIngredientChecked(ing.name)) {
        inPantry.push(ing);
      } else {
        toBuy.push(ing);
      }
    });

    return { ingredientsInPantry: inPantry, ingredientsToBuy: toBuy };
  }, [combinedIngredients, pantryItems, checkedIngredients]);

  // Calculate progress: items in pantry / total items
  const progressInfo = useMemo(() => {
    const total = combinedIngredients.length;
    const inPantryCount = ingredientsInPantry.length;
    const percentage = total > 0 ? (inPantryCount / total) * 100 : 0;
    return { total, inPantryCount, percentage };
  }, [combinedIngredients.length, ingredientsInPantry.length]);

  // Daily recommended values
  const dailyValues = {
    calories: 2000,
    protein: 50, // grams
    carbohydrates: 300, // grams
    fat: 65, // grams
    sugar: 50, // grams
    fiber: 25, // grams
  };
  const scrollY = useSharedValue(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    // Handle both importedData (from import flow) and recipeData (from recipe feed)
    const dataParam = params.importedData || params.recipeData;
    if (dataParam) {
      try {
        const parsed = JSON.parse(dataParam as string) as
          | Recipe
          | RecipeCreateInput;
        // Limit title to 40 characters
        const limitedTitle = parsed.title
          ? parsed.title.slice(0, 40)
          : parsed.title;
        // Set recipe data with all fields including coverImage
        setRecipeData({
          ...parsed,
          title: limitedTitle,
          // Ensure coverImage is preserved
          coverImage: parsed.coverImage || "",
        });

        // Parse missing fields if provided
        if (params.missingFields) {
          try {
            const missing = JSON.parse(params.missingFields as string);
            if (Array.isArray(missing)) {
              setMissingFields(missing);
            }
          } catch (error) {
            console.error("Failed to parse missingFields:", error);
          }
        }

        // Store original tags (auto-generated) when recipe is first loaded
        if (parsed.tags && parsed.tags.length > 0) {
          setOriginalTags([...parsed.tags]);
        } else {
          setOriginalTags([]);
        }

        // Get stored recipe to load rating and other fields if it exists
        if ("id" in parsed && parsed.id) {
          const storedRecipe = getRecipe(parsed.id);
          if (storedRecipe) {
            // Update recipeData with stored recipe data (rating, etc.)
            // Note: Prioritize coverImage from params (most recent) over stored
            setRecipeData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                // Keep coverImage from params (most recent), only use stored if params doesn't have one
                coverImage: prev.coverImage || storedRecipe.coverImage || "",
                // Use stored rating if it exists
                rating: storedRecipe.rating || prev.rating,
              };
            });
          }
          // Also update original tags if stored recipe has tags
          if (storedRecipe?.tags && storedRecipe.tags.length > 0) {
            // Only set if we haven't set them yet (to preserve auto-generated tags)
            setOriginalTags((prev) => {
              if (prev.length === 0) {
                return [...storedRecipe.tags];
              }
              return prev;
            });
          }
        }

        // Log coverImage for debugging
        console.log("Recipe detail - coverImage:", parsed.coverImage);
      } catch (error) {
        console.error("Failed to parse recipe data:", error);
      }
    }
  }, [params.importedData, params.recipeData, getRecipe]);

  // Check and generate nutritional info if missing or incomplete
  useEffect(() => {
    const checkAndGenerateNutrition = async () => {
      if (!recipeData) return;

      // Check if nutritional info is incomplete (has some but not all required values)
      const nutritionIncomplete = isNutritionIncomplete(recipeData.nutritionalInfo);

      if (
        nutritionIncomplete &&
        recipeData.ingredients &&
        recipeData.ingredients.length > 0
      ) {
        setIsLoadingNutrition(true);
        try {
          // Generate nutritional info from ingredients
          const generatedNutrition = await generateNutritionalInfo(
            recipeData.ingredients
          );

          // Merge with existing (if any) - prefer source data, fill in missing with generated
          const mergedNutrition = mergeNutrition(
            recipeData.nutritionalInfo,
            generatedNutrition
          );
          // Normalize to ensure all required fields are present
          const finalNutrition = normalizeNutrition(mergedNutrition);

          setRecipeData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              nutritionalInfo: finalNutrition,
            };
          });
        } catch (error) {
          console.error("Failed to generate nutritional info:", error);
          // Silently fail - user can still use the recipe without nutrition info
        } finally {
          setIsLoadingNutrition(false);
        }
      }
    };

    checkAndGenerateNutrition();
  }, [recipeData]);

  // Initialize timer states when recipe data loads (but don't auto-start)
  useEffect(() => {
    if (!recipeData?.steps) return;

    // Initialize timer states for steps with timerDuration or parse from instruction
    const initialStates: Record<
      string,
      {
        remaining: number;
        isRunning: boolean;
        isCompleted: boolean;
        isDismissed?: boolean;
      }
    > = {};

    recipeData.steps.forEach((step) => {
      // Use existing timerDuration or parse from instruction text
      const duration =
        step.timerDuration || parseTimeFromInstruction(step.instruction);
      if (duration) {
        initialStates[step.id] = {
          remaining: duration,
          isRunning: false,
          isCompleted: false,
          isDismissed: false,
        };
      }
    });

    setTimerStates(initialStates);

    // Cleanup timers on unmount or when recipe changes
    return () => {
      Object.values(timerIntervals.current).forEach((interval) => {
        clearInterval(interval);
      });
      Object.keys(timerIntervals.current).forEach((key) => {
        delete timerIntervals.current[key];
      });
    };
  }, [recipeData?.steps]);

  // Configure notifications
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  // Convert units (simple conversion - can be enhanced)
  const convertUnit = (
    quantity: number,
    fromUnit: string,
    toMetric: boolean
  ) => {
    if (toMetric) {
      // Convert to grams
      if (fromUnit.toLowerCase().includes("cup")) {
        // Rough conversions (varies by ingredient, but using common values)
        return Math.round(quantity * 200); // 1 cup ≈ 200g (varies by ingredient)
      }
      if (fromUnit.toLowerCase().includes("tbsp")) {
        return Math.round(quantity * 15); // 1 tbsp ≈ 15g
      }
      if (fromUnit.toLowerCase().includes("tsp")) {
        return Math.round(quantity * 5); // 1 tsp ≈ 5g
      }
      return quantity; // Already in grams or unknown
    } else {
      // Convert to cups
      if (fromUnit.toLowerCase().includes("g")) {
        const converted = quantity / 200; // 200g ≈ 1 cup
        return Number.isInteger(converted)
          ? converted
          : parseFloat(converted.toFixed(2));
      }
      return quantity; // Already in cups or unknown
    }
  };

  const customTags =
    recipeData?.tags?.filter((tag) => !originalTags.includes(tag)) || [];

  // Parse time duration from instruction text (e.g., "20 minutes", "5 min", "2 hours")
  // Returns duration in seconds, or null if no time found
  const parseTimeFromInstruction = (instruction: string): number | null => {
    if (!instruction) return null;

    // Patterns to match time expressions:
    // - "for 20 minutes", "for 5 min", "for 2 hours", "for 30 seconds"
    // - "20 minutes", "5 min", "2 hours", "30 sec"
    // - "bake 20 min", "simmer 5 minutes", "cook 2 hours"
    const timePatterns = [
      // Match "for X minutes/min" or "for X hours/hr" or "for X seconds/sec"
      /for\s+(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|hours?|hrs?|hr|seconds?|secs?|sec)/i,
      // Match "X minutes/min" or "X hours/hr" or "X seconds/sec" (without "for")
      /(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|hours?|hrs?|hr|seconds?|secs?|sec)/i,
    ];

    for (const pattern of timePatterns) {
      const match = instruction.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        if (isNaN(value) || value <= 0) continue;

        // Convert to seconds
        if (unit.includes("hour") || unit.includes("hr")) {
          return Math.round(value * 3600); // hours to seconds
        } else if (unit.includes("minute") || unit.includes("min")) {
          return Math.round(value * 60); // minutes to seconds
        } else if (unit.includes("second") || unit.includes("sec")) {
          return Math.round(value); // already in seconds
        }
      }
    }

    return null;
  };

  // Enrich instruction text with ingredient amounts
  const enrichInstructionWithAmounts = (instruction: string): string => {
    if (!recipeData || !recipeData.ingredients) return instruction;

    console.log(
      "[enrichInstructionWithAmounts] Original instruction:",
      instruction
    );

    let enrichedText = instruction;

    // Sort ingredients by name length (longest first) to match longer names first
    const ingredients = [...recipeData.ingredients].sort(
      (a, b) => b.name.length - a.name.length
    );

    console.log(
      "[enrichInstructionWithAmounts] Total ingredients to check:",
      ingredients.length
    );
    ingredients.forEach((ing) => {
      console.log(
        `[enrichInstructionWithAmounts] Ingredient: "${ing.name}", quantity: ${ing.quantity}, unit: "${ing.unit}"`
      );
    });

    // Collect all matches with their positions first
    const replacements: Array<{
      start: number;
      end: number;
      replacement: string;
    }> = [];

    ingredients.forEach((ing) => {
      const ingredientName = ing.name;
      const normalizedName = ingredientName.toLowerCase().trim();

      // Extract the main part of the ingredient name (before comma, parentheses, etc.)
      // This handles cases like "Rolled oats, traditional" -> "Rolled oats"
      const mainPart = ingredientName.split(/[,\(]/)[0].trim();
      const normalizedMainPart = mainPart.toLowerCase().trim();

      // Escape special regex characters in the ingredient name
      const escapedName = ingredientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedNormalizedName = normalizedName.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const escapedMainPart = mainPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedNormalizedMainPart = normalizedMainPart.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // Create pattern to match the ingredient name - try both full name and main part
      // This handles cases where instruction says "rolled oats" but ingredient is "Rolled oats, traditional"
      const pattern = new RegExp(
        `\\b(${escapedName}|${escapedNormalizedName}|${escapedMainPart}|${escapedNormalizedMainPart})\\b`,
        "gi"
      );

      console.log(
        `[enrichInstructionWithAmounts] Trying to match ingredient "${ingredientName}" (main part: "${mainPart}")`
      );

      let match;
      while ((match = pattern.exec(instruction)) !== null) {
        const offset = match.index;
        const matchText = match[0];

        console.log(
          `[enrichInstructionWithAmounts] Found ingredient "${ingredientName}" in instruction at position ${offset}, matched text: "${matchText}"`
        );

        // Use the matched text (what's actually in the instruction) for replacement
        // This preserves the capitalization/style from the instruction
        const ingredientTextToUse = matchText;

        // Check if there's already a quantity mentioned before this ingredient
        // Look backwards from the ingredient name to find any existing quantity
        const lookbackStart = Math.max(0, offset - 50);
        const lookbackText = instruction.substring(lookbackStart, offset);

        // Pattern to match quantities with units (more comprehensive)
        const quantityPattern =
          /(\d+\s*\/\s*\d+|\d+\s+\.\s*\d+|\d+\.\d+|\d+)\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|g|gram|grams|oz|ounce|ounces|lb|pound|pounds|ml|milliliter|milliliters|l|liter|liters|stick|sticks|piece|pieces|whole|clove|cloves|head|heads|bunch|bunches|can|cans|package|packages|container|containers|of|egg|eggs|large|medium|small)\s*/i;

        const quantityMatch = lookbackText.match(quantityPattern);
        const hasQuantityBefore = quantityMatch !== null;

        console.log(
          `[enrichInstructionWithAmounts] Has quantity before: ${hasQuantityBefore}`,
          hasQuantityBefore ? `(found: "${quantityMatch?.[0]}")` : ""
        );

        // Handle "to taste" ingredients
        if (ing.unit === "to taste" && ing.quantity === null) {
          // Check if "to taste" is already mentioned nearby
          const contextStart = Math.max(0, offset - 30);
          const contextEnd = Math.min(
            instruction.length,
            offset + matchText.length + 30
          );
          const context = instruction.substring(contextStart, contextEnd);
          const toTastePattern = /to\s+taste/i;
          const hasToTasteNearby = toTastePattern.test(context);

          if (!hasToTasteNearby) {
            // Replace ingredient name with "{ingredient} to taste" using matched text
            const replacement = `${ingredientTextToUse} to taste`;
            console.log(
              `[enrichInstructionWithAmounts] Adding "to taste" replacement: "${replacement}"`
            );
            replacements.push({
              start: offset,
              end: offset + matchText.length,
              replacement,
            });
          } else {
            console.log(
              `[enrichInstructionWithAmounts] "to taste" already mentioned nearby, skipping`
            );
          }
        } else if (ing.quantity !== null && ing.quantity > 0) {
          // Format the quantity nicely using fractions when appropriate
          const quantityStr = formatQuantity(ing.quantity, ing.unit);

          // Only include unit if it's not null
          const unitStr = ing.unit ? ` ${ing.unit}` : "";

          if (hasQuantityBefore && quantityMatch) {
            // Replace the existing quantity + ingredient with the formatted version
            const quantityStart = lookbackStart + (quantityMatch.index || 0);
            // Use the matched text from instruction to preserve capitalization
            const replacement = `${quantityStr}${unitStr} ${ingredientTextToUse}`;
            console.log(
              `[enrichInstructionWithAmounts] Replacing existing quantity with: "${replacement}" (from position ${quantityStart} to ${
                offset + matchText.length
              })`
            );
            replacements.push({
              start: quantityStart,
              end: offset + matchText.length,
              replacement,
            });
          } else {
            // Add quantity before ingredient name, using matched text from instruction
            const replacement = `${quantityStr}${unitStr} ${ingredientTextToUse}`;
            console.log(
              `[enrichInstructionWithAmounts] Adding quantity: "${replacement}" (at position ${offset})`
            );
            replacements.push({
              start: offset,
              end: offset + matchText.length,
              replacement,
            });
          }
        } else {
          console.log(
            `[enrichInstructionWithAmounts] Skipping ingredient "${ingredientName}" - quantity is null or 0`
          );
        }
      }
    });

    console.log(
      `[enrichInstructionWithAmounts] Total replacements to apply: ${replacements.length}`
    );

    // Apply replacements in reverse order to maintain correct indices
    replacements.sort((a, b) => b.start - a.start);
    replacements.forEach(({ start, end, replacement }) => {
      console.log(
        `[enrichInstructionWithAmounts] Applying replacement: "${replacement}" at positions ${start}-${end}`
      );
      enrichedText =
        enrichedText.substring(0, start) +
        replacement +
        enrichedText.substring(end);
    });

    console.log(
      "[enrichInstructionWithAmounts] Final enriched instruction:",
      enrichedText
    );

    return enrichedText;
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

    // Auto-close the swipeable after 1 second
    const swipeable = swipeableRefs.current[stepId];
    if (swipeable) {
      setTimeout(() => {
        swipeable.close();
      }, 1000);
    }
  };

  const handleShare = async () => {
    if (!recipeData) return;

    try {
      const titleToShare = recipeData.title.slice(0, 40);
      const shareText = `${titleToShare}\n\n${recipeData.sourceUrl || ""}`;
      await Share.share({
        message: shareText,
        title: titleToShare,
      });
      setShowMenu(false);
    } catch (error) {
      console.error("Error sharing recipe:", error);
    }
  };

  const handleAddToBook = (bookId: string) => {
    if (!recipeData) return;

    // Convert RecipeCreateInput to Recipe format
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

    // Add recipe to store if not already there
    addRecipe(recipe);

    // Add recipe to book with cover image
    addRecipeToBook(bookId, recipe.id, recipe.coverImage);

    Alert.alert("Success", "Recipe added to book!");
    setShowBookSelector(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (!recipeData) return;

    // Check if recipe has an id (it's a saved recipe, not just imported)
    let recipeId: string | null = null;
    if ("id" in recipeData && recipeData.id) {
      recipeId =
        typeof recipeData.id === "string"
          ? recipeData.id
          : String(recipeData.id);
    }

    if (!recipeId) {
      Alert.alert(
        "Cannot Delete",
        "This recipe hasn't been saved yet. Only saved recipes can be deleted."
      );
      setShowMenu(false);
      return;
    }

    Alert.alert(
      "Delete Recipe",
      `Are you sure you want to delete "${recipeData.title.slice(
        0,
        40
      )}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowMenu(false),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteRecipe(recipeId as string, user?.defaultKitchenId);
            setShowMenu(false);
            router.back();
          },
        },
      ]
    );
  };

  const handleStartEditTitle = () => {
    if (!recipeData) return;
    setEditedTitle(recipeData.title.slice(0, 40));
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (!recipeData) return;

    // Check if recipe has an id (it's a saved recipe, not just imported)
    let recipeId: string | null = null;
    if ("id" in recipeData && recipeData.id) {
      recipeId =
        typeof recipeData.id === "string"
          ? recipeData.id
          : String(recipeData.id);
    }

    if (!recipeId) {
      Alert.alert(
        "Cannot Edit",
        "This recipe hasn't been saved yet. Please save the recipe first before editing."
      );
      setIsEditingTitle(false);
      return;
    }

    const trimmedTitle = editedTitle.trim().slice(0, 40);

    if (!trimmedTitle) {
      Alert.alert("Error", "Recipe title cannot be empty.");
      return;
    }

    // Update the recipe in the store
    updateRecipe(recipeId, { title: trimmedTitle }, user?.defaultKitchenId);

    // Update local state
    setRecipeData({ ...recipeData, title: trimmedTitle });
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  // Helper to check if recipe can be edited
  const canEditRecipe = (): boolean => {
    if (!recipeData) return false;
    if (!("id" in recipeData)) return false;
    const id = recipeData.id;
    return id !== null && id !== undefined && typeof id === "string";
  };

  // Ingredients editing handlers
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
      const recipeId = recipeData.id;
      updateRecipe(
        recipeId,
        { ingredients: editedIngredients },
        user?.defaultKitchenId
      );
      setRecipeData({ ...recipeData, ingredients: editedIngredients });
      setIsEditingIngredients(false);
    }
  };

  const handleCancelEditIngredients = () => {
    setIsEditingIngredients(false);
    setEditedIngredients([]);
  };

  const handleAddIngredient = () => {
    const newIngredient: Ingredient = {
      name: "",
      quantity: null,
      unit: "",
      isChecked: false,
    };
    setEditedIngredients([...editedIngredients, newIngredient]);
  };

  const handleDeleteIngredient = (index: number) => {
    setEditedIngredients(editedIngredients.filter((_, i) => i !== index));
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

  // Instructions editing handlers
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
      const recipeId = recipeData.id;
      updateRecipe(recipeId, { steps: editedSteps }, user?.defaultKitchenId);
      setRecipeData({ ...recipeData, steps: editedSteps });
      setIsEditingInstructions(false);
    }
  };

  const handleCancelEditInstructions = () => {
    setIsEditingInstructions(false);
    setEditedSteps([]);
  };

  const handleAddStep = () => {
    const newStep: Step = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      instruction: "",
      isCompleted: false,
      isBeginnerFriendly: true,
    };
    setEditedSteps([...editedSteps, newStep]);
  };

  const handleDeleteStep = (stepId: string) => {
    setEditedSteps(editedSteps.filter((step) => step.id !== stepId));
  };

  const handleUpdateStep = (
    stepId: string,
    field: keyof Step,
    value: string | number | boolean | undefined
  ) => {
    const updated = editedSteps.map((step) =>
      step.id === stepId ? { ...step, [field]: value } : step
    );
    setEditedSteps(updated);
  };

  const startTimer = async (stepId: string, duration: number) => {
    if (duration <= 0) {
      return;
    }

    // Start timer first (don't wait for notification)
    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: duration,
        isRunning: true,
        isCompleted: false,
        isDismissed: false,
      },
    }));

    // Find the step to get instruction text for notification
    const step = recipeData?.steps.find((s) => s.id === stepId);
    if (!step) return;

    // Schedule notification asynchronously (don't block timer start)
    (async () => {
      try {
        // Request notification permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.log("Notification permission not granted");
          return;
        }

        // Calculate minutes for notification message
        const minutes = Math.round(duration / 60);

        // Schedule notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Timer Complete!",
            body: `Your BiteBook timer for ${minutes} minute${
              minutes !== 1 ? "s" : ""
            } is done`,
            sound: true,
          },
          trigger: {
            type: "timeInterval",
            seconds: duration,
            repeats: false,
          } as any,
        });
      } catch (error) {
        console.error("Failed to schedule notification:", error);
        // Continue with timer even if notification fails
      }
    })();

    // Start interval
    timerIntervals.current[stepId] = setInterval(() => {
      setTimerStates((prev) => {
        const current = prev[stepId];
        if (!current) return prev;

        if (current.remaining <= 1) {
          // Timer completed
          clearInterval(timerIntervals.current[stepId]);
          delete timerIntervals.current[stepId];
          return {
            ...prev,
            [stepId]: {
              remaining: 0,
              isRunning: false,
              isCompleted: true,
              isDismissed: false,
            },
          };
        }

        return {
          ...prev,
          [stepId]: {
            ...current,
            remaining: current.remaining - 1,
          },
        };
      });
    }, 1000);
  };

  const renderSwipeRightAction = (step: Step, isCompleted: boolean) => {
    return (
      <View
        className="bg-dark-sage rounded-xl items-center justify-center px-6 mb-4"
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: 80,
        }}
      >
        <View className="items-center">
          <Check size={24} color="#FAF9F7" />
          <Text className="text-off-white text-xs">
            {isCompleted ? "Undo" : "Done"}
          </Text>
        </View>
      </View>
    );
  };

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-off-white">
        <SafeAreaView
          className="absolute top-0 left-0 right-0 z-10"
          edges={["top"]}
          pointerEvents="box-none"
        >
          {/* Header with Back Button */}
          <Animated.View
            style={[
              headerOverlayStyle,
              {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 24,
                paddingVertical: 12,
                backgroundColor: "#FAF9F7",
              },
            ]}
            pointerEvents="box-none"
          >
            <RNTouchableOpacity
              onPress={() => {
                router.back();
              }}
              hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
              style={{
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#3E3E3E" pointerEvents="none" />
            </RNTouchableOpacity>
            <Text
              className="text-lg font-bold text-charcoal-gray ml-4 flex-1"
              numberOfLines={1}
              style={{ fontFamily: "Lora_700Bold" }}
            >
              {recipeData.title.slice(0, 40)}
            </Text>
            <RNTouchableOpacity
              onPress={() => setShowMenu(true)}
              hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
              style={{
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
              }}
              activeOpacity={0.7}
            >
              <MoreVertical size={24} color="#3E3E3E" pointerEvents="none" />
            </RNTouchableOpacity>
          </Animated.View>
        </SafeAreaView>

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
            {/* Collapsible Header Image */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: HEADER_HEIGHT,
                  overflow: "hidden",
                },
                headerImageStyle,
              ]}
            >
              {recipeData.coverImage ? (
                <Image
                  source={{ uri: recipeData.coverImage }}
                  style={{ width: "100%", height: HEADER_HEIGHT }}
                  contentFit="cover"
                  transition={200}
                  placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
                />
              ) : (
                <View className="bg-soft-beige w-full h-full items-center justify-center">
                  <Text className="text-charcoal-gray/50">No Image</Text>
                </View>
              )}

              {/* Header Content Overlay */}
              <View
                className="absolute top-0 left-0 right-0 bottom-0"
                style={{ zIndex: 10, justifyContent: "flex-end" }}
              >
                {/* Navigation buttons at top */}
                <SafeAreaView
                  edges={["top"]}
                  style={{ position: "absolute", top: 0, left: 0, right: 0 }}
                >
                  <View className="flex-row items-center justify-between w-full px-4">
                    <RNTouchableOpacity
                      onPress={() => {
                        router.back();
                      }}
                      hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: "rgba(231, 216, 201, 0.8)",
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      activeOpacity={0.7}
                    >
                      <ArrowLeft
                        size={20}
                        color="#3E3E3E"
                        pointerEvents="none"
                      />
                    </RNTouchableOpacity>

                    <RNTouchableOpacity
                      onPress={() => setShowMenu(true)}
                      hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: "rgba(231, 216, 201, 0.8)",
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      activeOpacity={0.7}
                    >
                      <MoreVertical
                        size={20}
                        color="#3E3E3E"
                        pointerEvents="none"
                      />
                    </RNTouchableOpacity>
                  </View>
                </SafeAreaView>

                {/* Background overlay with content - aligned to bottom of image */}
                <Animated.View
                  style={[
                    headerContentStyle,
                    {
                      backgroundColor: "rgba(231, 216, 201, 0.8)",
                      paddingHorizontal: 24,
                      paddingBottom: 12,
                      paddingTop: 12,
                    },
                  ]}
                >
                  <View className="flex-row items-center mb-2">
                    {isEditingTitle ? (
                      <View className="flex-1 flex-row items-center">
                        <TextInput
                          value={editedTitle}
                          onChangeText={(text) => {
                            if (text.length <= 40) {
                              setEditedTitle(text);
                            }
                          }}
                          maxLength={40}
                          className="flex-1 text-3xl font-bold text-charcoal-gray"
                          style={{ fontFamily: "Lora_700Bold" }}
                          autoFocus
                          onSubmitEditing={handleSaveTitle}
                          onBlur={handleSaveTitle}
                        />
                        <RNTouchableOpacity
                          onPress={handleSaveTitle}
                          className="ml-2 p-2"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Check size={20} color="#5A6E6C" />
                        </RNTouchableOpacity>
                        <RNTouchableOpacity
                          onPress={handleCancelEditTitle}
                          className="ml-1 p-2"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <X size={20} color="#5A6E6C" pointerEvents="none" />
                        </RNTouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View className="flex-1">
                          <Text
                            className={`text-3xl font-bold flex-1 ${
                              missingFields.includes("title")
                                ? "text-dusty-rose"
                                : "text-charcoal-gray"
                            }`}
                            numberOfLines={2}
                            style={{ fontFamily: "Lora_700Bold" }}
                          >
                            {recipeData.title.slice(0, 40) || "Untitled Recipe"}
                          </Text>
                          {missingFields.includes("title") && (
                            <Text className="text-xs text-dusty-rose mt-1">
                              Missing title - please edit
                            </Text>
                          )}
                        </View>
                        {"id" in recipeData && recipeData.id && (
                          <RNTouchableOpacity
                            onPress={handleStartEditTitle}
                            className="ml-2 p-2"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Pencil
                              size={20}
                              color="#5A6E6C"
                              pointerEvents="none"
                            />
                          </RNTouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                  <View className="flex flex-row items-center justify-between">
                    {recipeData.originalAuthor ? (
                      <Text className="text-base text-charcoal-gray/90">
                        By {recipeData.originalAuthor}
                      </Text>
                    ) : (
                      <View />
                    )}
                    {recipeData.sourceUrl ? (
                      <RNTouchableOpacity
                        onPress={async () => {
                          try {
                            const url = recipeData.sourceUrl;
                            const canOpen = await Linking.canOpenURL(url);
                            if (canOpen) {
                              await Linking.openURL(url);
                            }
                          } catch (error) {
                            Alert.alert(
                              "Error",
                              "Could not open the recipe URL"
                            );
                          }
                        }}
                        className="flex-row items-center"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text className="text-base text-charcoal-gray/90 mr-1">
                          Original Recipe
                        </Text>
                        <ExternalLink size={16} color="#5A6E6C" />
                      </RNTouchableOpacity>
                    ) : (
                      <View />
                    )}
                  </View>
                </Animated.View>
              </View>
            </Animated.View>

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

              {/* Prep Time, Total Time, and Servings Cards */}
              <View className="flex-row items-center justify-between mb-4 gap-3">
                {/* Prep Time Card */}
                {recipeData.prepTime && (
                  <View className="flex-1 bg-soft-beige rounded-xl px-4 py-3 items-center">
                    <ChefHat size={20} color="#5A6E6C" />
                    <Text className="text-charcoal-gray font-semibold text-base mt-1">
                      {recipeData.prepTime} mins
                    </Text>
                    <Text className="text-charcoal-gray/60 text-xs mt-0.5">
                      prep
                    </Text>
                  </View>
                )}

                {/* Total Time Card */}
                {(() => {
                  // Use recipe.totalTime if available, otherwise calculate from step timers
                  const totalTime =
                    recipeData.totalTime ||
                    (() => {
                      const totalSeconds =
                        recipeData.steps?.reduce(
                          (sum, step) => sum + (step.timerDuration || 0),
                          0
                        ) || 0;
                      return totalSeconds > 0
                        ? Math.round(totalSeconds / 60)
                        : null;
                    })();

                  return totalTime !== null && totalTime !== undefined ? (
                    <View className="flex-1 bg-soft-beige rounded-xl px-4 py-3 items-center">
                      <Clock size={20} color="#5A6E6C" />
                      <Text className="text-charcoal-gray font-semibold text-base mt-1">
                        {totalTime} mins
                      </Text>
                      <Text className="text-charcoal-gray/60 text-xs mt-0.5">
                        total
                      </Text>
                    </View>
                  ) : null;
                })()}

                {/* Servings Card */}
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

              {/* Divider Line */}
              <View className="h-px bg-warm-sand mb-4" />

              {/* Star Rating */}
              <View className="flex-row items-center justify-center mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <RNTouchableOpacity
                    key={star}
                    onPress={() => {
                      const newRating =
                        recipeData.rating === star ? undefined : star;
                      setRecipeData((prev) =>
                        prev ? { ...prev, rating: newRating } : null
                      );
                      // Update in store if recipe exists (check if it's a Recipe with id)
                      if (
                        "id" in recipeData &&
                        typeof recipeData.id === "string"
                      ) {
                        const storedRecipe = getRecipe(recipeData.id);
                        if (storedRecipe) {
                          updateRecipe(
                            storedRecipe.id,
                            {
                              rating: newRating,
                            },
                            user?.defaultKitchenId
                          );
                        }
                      }
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={24}
                      color={
                        recipeData.rating && star <= recipeData.rating
                          ? "#7A2E2A"
                          : "#D1D5DB"
                      }
                      fill={
                        recipeData.rating && star <= recipeData.rating
                          ? "#7A2E2A"
                          : "none"
                      }
                    />
                  </RNTouchableOpacity>
                ))}
              </View>

              {/* Divider Line */}
              <View className="h-px bg-warm-sand mb-6" />

              {/* Missing Fields Warning Banner */}
              {missingFields.length > 0 && (
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

              {/* Ingredients Tab */}
              {activeTab === "ingredients" && (
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
                          <ChevronDown
                            size={20}
                            color="#3E3E3E"
                            pointerEvents="none"
                          />
                        ) : (
                          <ChevronUp
                            size={20}
                            color="#3E3E3E"
                            pointerEvents="none"
                          />
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
                              <Text className="text-base text-charcoal-gray flex-1 flex-wrap">
                                {item}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Scale and Unit Dropdowns */}
                  {(showScaleDropdown || showUnitsDropdown) && (
                    <Pressable
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 50,
                      }}
                      onPress={() => {
                        setShowScaleDropdown(false);
                        setShowUnitsDropdown(false);
                      }}
                    />
                  )}
                  <View className="flex-row items-center justify-between mb-4">
                    {/* Scale Dropdown */}
                    <View
                      className="flex-1 mr-3 flex-row items-center"
                      style={{ zIndex: showScaleDropdown ? 100 : 1 }}
                    >
                      <Text className="text-charcoal-gray/60 text-sm mr-2">
                        Scale:
                      </Text>
                      <View className="flex-1">
                        <RNTouchableOpacity
                          onPress={() => {
                            setShowScaleDropdown(!showScaleDropdown);
                            setShowUnitsDropdown(false);
                          }}
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
                                {
                                  rotate: showScaleDropdown ? "180deg" : "0deg",
                                },
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
                                  setRecipeScale(scale);
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

                    {/* Units Dropdown */}
                    <View
                      className="flex-1 flex-row items-center"
                      style={{ zIndex: showUnitsDropdown ? 100 : 1 }}
                    >
                      <Text className="text-charcoal-gray/60 text-sm mr-2">
                        Units:
                      </Text>
                      <View className="flex-1">
                        <RNTouchableOpacity
                          onPress={() => {
                            setShowUnitsDropdown(!showUnitsDropdown);
                            setShowScaleDropdown(false);
                          }}
                          className="bg-soft-beige rounded-xl px-4 py-3 flex-row items-center justify-between"
                          activeOpacity={0.7}
                          style={{ minHeight: 44 }}
                        >
                          <Text className="text-charcoal-gray font-semibold text-sm">
                            {useMetric ? "Grams" : "Cups"}
                          </Text>
                          <ChevronDown
                            size={18}
                            color="#3E3E3E"
                            pointerEvents="none"
                            style={{
                              transform: [
                                {
                                  rotate: showUnitsDropdown ? "180deg" : "0deg",
                                },
                              ],
                            }}
                          />
                        </RNTouchableOpacity>
                        {showUnitsDropdown && (
                          <View className="absolute top-full left-0 right-0 mt-1 bg-off-white rounded-xl shadow-lg border border-warm-sand/50 overflow-hidden z-50">
                            <RNTouchableOpacity
                              onPress={() => {
                                setUseMetric(false);
                                setShowUnitsDropdown(false);
                              }}
                              className={`px-4 py-3 ${
                                !useMetric ? "bg-dark-sage" : ""
                              }`}
                              activeOpacity={0.7}
                            >
                              <Text
                                className={`text-sm font-semibold ${
                                  !useMetric
                                    ? "text-off-white"
                                    : "text-charcoal-gray"
                                }`}
                              >
                                Cups
                              </Text>
                            </RNTouchableOpacity>
                            <RNTouchableOpacity
                              onPress={() => {
                                setUseMetric(true);
                                setShowUnitsDropdown(false);
                              }}
                              className={`px-4 py-3 ${
                                useMetric ? "bg-dark-sage" : ""
                              }`}
                              activeOpacity={0.7}
                            >
                              <Text
                                className={`text-sm font-semibold ${
                                  useMetric
                                    ? "text-off-white"
                                    : "text-charcoal-gray"
                                }`}
                              >
                                Grams
                              </Text>
                            </RNTouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Render Ingredient Item */}
                  {(() => {
                    const handleIngredientCheck = (
                      ingredientName: string,
                      ingredient: Ingredient
                    ) => {
                      const normalizedName = ingredientName
                        .toLowerCase()
                        .trim();

                      setCheckedIngredients((prev) => {
                        const newSet = new Set(prev);

                        // Check if already checked
                        const isChecked = Array.from(newSet).some(
                          (checked) =>
                            checked.toLowerCase().trim() === normalizedName
                        );

                        if (isChecked) {
                          // Uncheck - remove from set
                          Array.from(newSet).forEach((checked) => {
                            if (
                              checked.toLowerCase().trim() === normalizedName
                            ) {
                              newSet.delete(checked);
                            }
                          });
                          // Note: We don't remove from pantry when unchecking
                          // The user might want to keep it in pantry
                        } else {
                          // Check - add to set (use original name for consistency)
                          newSet.add(ingredientName);

                          // Add to pantry if not already there
                          const alreadyInPantry = pantryItems.some(
                            (item) =>
                              item.name.toLowerCase().trim() === normalizedName
                          );

                          if (
                            !alreadyInPantry &&
                            ingredient.quantity !== null
                          ) {
                            addPantryItem({
                              name: ingredient.name,
                              quantity: ingredient.quantity,
                              unit: ingredient.unit,
                            });
                          }

                          // Remove from shopping list if it exists there
                          const shoppingItem = shoppingItems.find(
                            (item) =>
                              item.name.toLowerCase().trim() === normalizedName
                          );
                          if (shoppingItem) {
                            deleteShoppingItem(shoppingItem.id);
                          }
                        }

                        return newSet;
                      });
                    };

                    const isIngredientChecked = (
                      ingredientName: string
                    ): boolean => {
                      const normalizedName = ingredientName
                        .toLowerCase()
                        .trim();
                      return Array.from(checkedIngredients).some(
                        (checked) =>
                          checked.toLowerCase().trim() === normalizedName
                      );
                    };

                    const renderIngredient = (
                      ingredient: Ingredient,
                      index: number,
                      isInPantry: boolean
                    ) => {
                      // Handle moving ingredient to/from pantry
                      const handleMoveIngredient = () => {
                        if (isInPantry) {
                          // Move from pantry back to "Need to Buy"
                          const pantryItem = pantryItems.find(
                            (item) =>
                              item.name.toLowerCase().trim() ===
                              ingredient.name.toLowerCase().trim()
                          );
                          if (pantryItem) {
                            deletePantryItem(pantryItem.id);
                          }
                          // Also remove from checked ingredients if it's there
                          setCheckedIngredients((prev) => {
                            const newSet = new Set(prev);
                            newSet.delete(ingredient.name);
                            return newSet;
                          });
                          // Show toast
                          setToastMessage("Moved to Need to Buy");
                        } else {
                          // Move from "Need to Buy" to pantry
                          addPantryItem({
                            name: ingredient.name,
                            quantity: ingredient.quantity || 1,
                            unit: ingredient.unit || "item",
                          });
                          // Show toast
                          setToastMessage("Moved to Pantry");
                        }
                      };

                      // Handle "to taste" ingredients - don't scale or convert
                      if (ingredient.unit === "to taste") {
                        const checked = isIngredientChecked(ingredient.name);
                        const inPantry = pantryItems.some(
                          (item) =>
                            item.name.toLowerCase().trim() ===
                            ingredient.name.toLowerCase().trim()
                        );

                        return (
                          <View
                            key={`${ingredient.name}-${index}`}
                            className="flex-row items-center mb-3 bg-soft-beige rounded-xl px-4 py-4"
                            style={{ minHeight: 44 }}
                          >
                            <Text className="flex-1 text-base text-charcoal-gray">
                              {decodeHtmlEntities(ingredient.name)} to taste
                            </Text>
                            {/* Move button */}
                            <RNTouchableOpacity
                              onPress={handleMoveIngredient}
                              className="ml-3 p-2"
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              {isInPantry ? (
                                <ShoppingBag
                                  size={18}
                                  color="#5A6E6C"
                                  pointerEvents="none"
                                />
                              ) : (
                                <Package
                                  size={18}
                                  color="#5A6E6C"
                                  pointerEvents="none"
                                />
                              )}
                            </RNTouchableOpacity>
                          </View>
                        );
                      }

                      // Apply scaling to ingredient quantity
                      const scaledQuantity =
                        (ingredient.quantity || 0) * recipeScale;

                      // Calculate display quantity (with unit conversion if needed)
                      let displayQuantity: number | string = scaledQuantity;
                      let displayUnit = ingredient.unit;

                      // Check if this is a whole item (eggs, pieces, etc.) - don't convert these
                      const wholeItemUnits = [
                        "egg",
                        "eggs",
                        "piece",
                        "pieces",
                        "whole",
                        "item",
                        "items",
                        "large",
                        "medium",
                        "small",
                      ];
                      const isWholeItem =
                        ingredient.unit &&
                        wholeItemUnits.some((u) =>
                          ingredient.unit!.toLowerCase().includes(u)
                        );

                      if (useMetric) {
                        // Convert to metric
                        if (
                          !isWholeItem &&
                          ingredient.unit &&
                          (ingredient.unit.toLowerCase().includes("cup") ||
                            ingredient.unit.toLowerCase().includes("tbsp") ||
                            ingredient.unit.toLowerCase().includes("tsp"))
                        ) {
                          displayQuantity = convertUnit(
                            scaledQuantity,
                            ingredient.unit,
                            true
                          );
                          displayUnit = "g";
                        } else {
                          displayQuantity = scaledQuantity;
                          displayUnit = ingredient.unit;
                        }
                      } else {
                        // Convert from metric to imperial
                        if (
                          !isWholeItem &&
                          ingredient.unit &&
                          ingredient.unit.toLowerCase().includes("g")
                        ) {
                          displayQuantity = convertUnit(
                            scaledQuantity,
                            ingredient.unit,
                            false
                          );
                          displayUnit = "cups";
                        } else {
                          displayQuantity = scaledQuantity;
                          displayUnit = ingredient.unit;
                        }
                      }

                      // Format quantity as fraction for display (only for volume units)
                      // Ensure we have a valid number
                      const quantityToFormat =
                        typeof displayQuantity === "number"
                          ? displayQuantity
                          : typeof displayQuantity === "string"
                          ? parseFloat(displayQuantity) || 0
                          : 0;

                      // Only format and display quantity if it's greater than 0
                      const shouldShowQuantity = quantityToFormat > 0;
                      const formattedQuantity = shouldShowQuantity
                        ? formatQuantity(quantityToFormat, displayUnit)
                        : "";

                      const checked = isIngredientChecked(ingredient.name);
                      const inPantry = pantryItems.some(
                        (item) =>
                          item.name.toLowerCase().trim() ===
                          ingredient.name.toLowerCase().trim()
                      );

                      return (
                        <View
                          key={`${ingredient.name}-${index}`}
                          className="flex-row items-center mb-3 bg-soft-beige rounded-xl px-4 py-4"
                          style={{ minHeight: 44 }}
                        >
                          <Text className="flex-1 text-base text-charcoal-gray">
                            {shouldShowQuantity && (
                              <>
                                <Text className="font-semibold">
                                  {formattedQuantity}
                                </Text>
                                {displayUnit && (
                                  <>
                                    {" "}
                                    <Text className="font-semibold">
                                      {displayUnit}
                                    </Text>
                                  </>
                                )}{" "}
                              </>
                            )}
                            {decodeHtmlEntities(ingredient.name)}
                          </Text>
                          {/* Move button */}
                          <RNTouchableOpacity
                            onPress={handleMoveIngredient}
                            className="ml-3 p-2"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            {isInPantry ? (
                              <ShoppingBag
                                size={18}
                                color="#5A6E6C"
                                pointerEvents="none"
                              />
                            ) : (
                              <Package
                                size={18}
                                color="#5A6E6C"
                                pointerEvents="none"
                              />
                            )}
                          </RNTouchableOpacity>
                        </View>
                      );
                    };

                    return (
                      <>
                        {/* Edit Mode Header */}
                        {isEditingIngredients ? (
                          <View className="mb-4 flex-row items-center justify-between">
                            <Text className="text-xl font-bold text-charcoal-gray">
                              Edit Ingredients
                            </Text>
                            <View className="flex-row gap-2">
                              <RNTouchableOpacity
                                onPress={handleCancelEditIngredients}
                                className="bg-warm-sand rounded-lg px-4 py-2"
                                activeOpacity={0.7}
                              >
                                <Text className="text-charcoal-gray font-semibold">
                                  Cancel
                                </Text>
                              </RNTouchableOpacity>
                              <RNTouchableOpacity
                                onPress={handleSaveIngredients}
                                className="bg-dark-sage rounded-lg px-4 py-2"
                                activeOpacity={0.7}
                              >
                                <Text className="text-off-white font-semibold">
                                  Save
                                </Text>
                              </RNTouchableOpacity>
                            </View>
                          </View>
                        ) : null}

                        {/* Progress Tracker */}
                        {!isEditingIngredients &&
                          combinedIngredients.length > 0 && (
                            <View className="mb-6">
                              <View className="flex-row items-center justify-between mb-2">
                                <Text className="text-base font-semibold text-charcoal-gray">
                                  Ingredients in Pantry
                                </Text>
                                <Text className="text-sm text-charcoal-gray/60">
                                  {progressInfo.inPantryCount} /{" "}
                                  {progressInfo.total}
                                </Text>
                              </View>
                              <View className="h-2 bg-warm-sand rounded-full overflow-hidden">
                                <View
                                  className="h-full bg-dark-sage rounded-full transition-all"
                                  style={{
                                    width: `${progressInfo.percentage}%`,
                                  }}
                                />
                              </View>
                            </View>
                          )}

                        {/* Edit Mode: Show all ingredients as editable */}
                        {isEditingIngredients ? (
                          <View className="mb-6">
                            {editedIngredients.map((ingredient, index) => (
                              <View
                                key={index}
                                className="mb-3 bg-soft-beige rounded-xl px-4 py-3 flex-row items-center"
                              >
                                <View className="flex-1 flex-row items-center gap-2">
                                  {/* Quantity Input */}
                                  <TextInput
                                    value={
                                      ingredient.quantity === null
                                        ? ""
                                        : formatDecimal(ingredient.quantity)
                                    }
                                    onChangeText={(text) => {
                                      if (text === "" || text === "to taste") {
                                        handleUpdateIngredient(
                                          index,
                                          "quantity",
                                          null
                                        );
                                        if (text === "to taste") {
                                          handleUpdateIngredient(
                                            index,
                                            "unit",
                                            "to taste"
                                          );
                                        }
                                      } else {
                                        const num = parseFloat(text);
                                        if (!isNaN(num)) {
                                          handleUpdateIngredient(
                                            index,
                                            "quantity",
                                            num
                                          );
                                        }
                                      }
                                    }}
                                    placeholder="Qty"
                                    className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                                    style={{ minWidth: 60, maxWidth: 80 }}
                                    keyboardType="decimal-pad"
                                  />
                                  {/* Unit Input */}
                                  <TextInput
                                    value={ingredient.unit}
                                    onChangeText={(text) =>
                                      handleUpdateIngredient(
                                        index,
                                        "unit",
                                        text
                                      )
                                    }
                                    placeholder="Unit"
                                    className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                                    style={{ minWidth: 80, maxWidth: 120 }}
                                  />
                                  {/* Name Input */}
                                  <TextInput
                                    value={decodeHtmlEntities(ingredient.name)}
                                    onChangeText={(text) =>
                                      handleUpdateIngredient(
                                        index,
                                        "name",
                                        text
                                      )
                                    }
                                    placeholder="Ingredient name"
                                    className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-2"
                                    style={{ flex: 2 }}
                                  />
                                </View>
                                <RNTouchableOpacity
                                  onPress={() => handleDeleteIngredient(index)}
                                  className="ml-2 w-10 h-10 items-center justify-center"
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  activeOpacity={0.7}
                                >
                                  <X
                                    size={20}
                                    color="#D7B4B3"
                                    pointerEvents="none"
                                  />
                                </RNTouchableOpacity>
                              </View>
                            ))}
                            <RNTouchableOpacity
                              onPress={handleAddIngredient}
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
                                    We couldn't extract ingredients from the
                                    image. Please add them manually using the
                                    Edit button.
                                  </Text>
                                </View>
                              )}

                            {/* Need to Buy Section */}
                            {ingredientsToBuy.length > 0 && (
                              <View className="mb-6">
                                {/* Add to Shopping List Button or Status Text */}
                                {shoppingListStatus.hasAdded ? (
                                  <View className="bg-soft-beige rounded-xl py-3 px-4 mb-4 flex-row items-center justify-center">
                                    <Check size={20} color="#5A6E6C" />
                                    <Text className="text-dark-sage text-base font-semibold ml-2">
                                      Ingredients added to shopping list
                                    </Text>
                                  </View>
                                ) : (
                                  <RNTouchableOpacity
                                    onPress={() => {
                                      // Use original recipe ingredients, not combined ones, to preserve exact quantities
                                      const originalIngredientsToBuy =
                                        recipeData?.ingredients?.filter(
                                          (ing) => {
                                            const normalizedName = ing.name
                                              .toLowerCase()
                                              .trim();
                                            const isInPantry = pantryItems.some(
                                              (item) =>
                                                item.name
                                                  .toLowerCase()
                                                  .trim() === normalizedName
                                            );
                                            const isChecked = Array.from(
                                              checkedIngredients
                                            ).some(
                                              (checked) =>
                                                checked.toLowerCase().trim() ===
                                                normalizedName
                                            );
                                            return !isInPantry && !isChecked;
                                          }
                                        ) || [];
                                      addItemsToShoppingList(
                                        originalIngredientsToBuy,
                                        recipeId,
                                        user?.defaultKitchenId
                                      );
                                    }}
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
                                  {canEditRecipe() && (
                                    <RNTouchableOpacity
                                      onPress={handleStartEditIngredients}
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
                      </>
                    );
                  })()}

                  {/* Nutrition Section */}
                  {recipeData.nutritionalInfo &&
                    Object.keys(recipeData.nutritionalInfo).length > 0 && (
                      <View className="mt-6 mb-6">
                        <View className="flex-row items-center justify-between mb-4">
                          <Text className="text-2xl font-bold text-charcoal-gray">
                            Nutrition
                          </Text>
                          {/* Serving Toggle - only show when not loading */}
                          {!isLoadingNutrition && (
                            <View className="flex-row bg-soft-beige rounded-full p-1">
                              <RNTouchableOpacity
                                onPress={() => setViewByServing(true)}
                                className={`px-3 py-1.5 rounded-full items-center ${
                                  viewByServing ? "bg-dark-sage" : ""
                                }`}
                                activeOpacity={0.7}
                                style={{
                                  minHeight: 32,
                                  justifyContent: "center",
                                }}
                              >
                                <Text
                                  className={`text-xs font-semibold ${
                                    viewByServing
                                      ? "text-off-white"
                                      : "text-charcoal-gray"
                                  }`}
                                >
                                  Per Serving
                                </Text>
                              </RNTouchableOpacity>
                              <RNTouchableOpacity
                                onPress={() => setViewByServing(false)}
                                className={`px-3 py-1.5 rounded-full items-center ${
                                  !viewByServing ? "bg-dark-sage" : ""
                                }`}
                                activeOpacity={0.7}
                                style={{
                                  minHeight: 32,
                                  justifyContent: "center",
                                }}
                              >
                                <Text
                                  className={`text-xs font-semibold ${
                                    !viewByServing
                                      ? "text-off-white"
                                      : "text-charcoal-gray"
                                  }`}
                                >
                                  Whole Recipe
                                </Text>
                              </RNTouchableOpacity>
                            </View>
                          )}
                        </View>

                        <View className="bg-soft-beige rounded-xl px-4 py-4">
                          {isLoadingNutrition ? (
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
                              {/* Calories - Always show */}
                                <View className="mb-4">
                                  <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-charcoal-gray font-semibold">
                                      Calories
                                    </Text>
                                    <Text className="text-charcoal-gray font-semibold">
                                      {viewByServing
                                        ? formatDecimal(
                                          (recipeData.nutritionalInfo.calories || 0) / servings
                                          )
                                        : formatDecimal(
                                          recipeData.nutritionalInfo.calories || 0
                                          )}
                                      {viewByServing && (
                                        <Text className="text-charcoal-gray/60 text-sm">
                                          {" "}
                                          / {dailyValues.calories}
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                  {viewByServing && (
                                    <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                      <View
                                        className="h-full bg-dark-sage rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                          ((recipeData.nutritionalInfo.calories || 0) /
                                              servings /
                                              dailyValues.calories) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </View>
                                  )}
                                </View>

                              {/* Protein - Always show */}
                                <View className="mb-4">
                                  <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-charcoal-gray font-semibold">
                                      Protein
                                    </Text>
                                    <Text className="text-charcoal-gray font-semibold">
                                      {viewByServing
                                        ? formatDecimal(
                                          (recipeData.nutritionalInfo.protein || 0) / servings
                                          )
                                        : formatDecimal(
                                          recipeData.nutritionalInfo.protein || 0
                                          )}
                                      g
                                      {viewByServing && (
                                        <Text className="text-charcoal-gray/60 text-sm">
                                          {" "}
                                          / {dailyValues.protein}g
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                  {viewByServing && (
                                    <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                      <View
                                        className="h-full bg-dark-sage rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                          ((recipeData.nutritionalInfo.protein || 0) /
                                              servings /
                                              dailyValues.protein) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </View>
                                  )}
                                </View>

                              {/* Carbs - Always show */}
                                <View className="mb-4">
                                  <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-charcoal-gray font-semibold">
                                      Carbs
                                    </Text>
                                    <Text className="text-charcoal-gray font-semibold">
                                      {viewByServing
                                        ? formatDecimal(
                                          (recipeData.nutritionalInfo.carbohydrates || 0) / servings
                                          )
                                        : formatDecimal(
                                          recipeData.nutritionalInfo.carbohydrates || 0
                                          )}
                                      g
                                      {viewByServing && (
                                        <Text className="text-charcoal-gray/60 text-sm">
                                          {" "}
                                          / {dailyValues.carbohydrates}g
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                  {viewByServing && (
                                    <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                      <View
                                        className="h-full bg-dark-sage rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                          ((recipeData.nutritionalInfo.carbohydrates || 0) /
                                              servings /
                                              dailyValues.carbohydrates) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </View>
                                  )}
                                </View>

                              {/* Sugar - Always show */}
                              <View className="mb-4">
                                <View className="flex-row items-center justify-between mb-1">
                                  <Text className="text-charcoal-gray font-semibold">
                                    Sugar
                                  </Text>
                                  <Text className="text-charcoal-gray font-semibold">
                                    {viewByServing
                                      ? formatDecimal(
                                          (recipeData.nutritionalInfo.sugar || 0) / servings
                                        )
                                      : formatDecimal(
                                          recipeData.nutritionalInfo.sugar || 0
                                        )}
                                    g
                                    {viewByServing && (
                                      <Text className="text-charcoal-gray/60 text-sm">
                                        {" "}
                                        / {dailyValues.sugar}g
                                      </Text>
                                    )}
                                  </Text>
                                </View>
                                {viewByServing && (
                                  <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                    <View
                                      className="h-full bg-dark-sage rounded-full"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          ((recipeData.nutritionalInfo.sugar || 0) /
                                            servings /
                                            dailyValues.sugar) *
                                            100
                                        )}%`,
                                      }}
                                    />
                                  </View>
                                )}
                              </View>

                              {/* Fat - Always show */}
                                <View className="mb-4">
                                  <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-charcoal-gray font-semibold">
                                      Fat
                                    </Text>
                                    <Text className="text-charcoal-gray font-semibold">
                                      {viewByServing
                                        ? formatDecimal(
                                          (recipeData.nutritionalInfo.fat || 0) / servings
                                          )
                                        : formatDecimal(
                                          recipeData.nutritionalInfo.fat || 0
                                          )}
                                      g
                                      {viewByServing && (
                                        <Text className="text-charcoal-gray/60 text-sm">
                                          {" "}
                                          / {dailyValues.fat}g
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                  {viewByServing && (
                                    <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                      <View
                                        className="h-full bg-dark-sage rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                          ((recipeData.nutritionalInfo.fat || 0) /
                                              servings /
                                              dailyValues.fat) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </View>
                                  )}
                                </View>

                              {recipeData.nutritionalInfo.fiber && (
                                <View>
                                  <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-charcoal-gray font-semibold">
                                      Fiber
                                    </Text>
                                    <Text className="text-charcoal-gray font-semibold">
                                      {viewByServing
                                        ? formatDecimal(
                                            (recipeData.nutritionalInfo.fiber ||
                                              0) / servings
                                          )
                                        : formatDecimal(
                                            recipeData.nutritionalInfo.fiber ||
                                              0
                                          )}
                                      g
                                      {viewByServing && (
                                        <Text className="text-charcoal-gray/60 text-sm">
                                          {" "}
                                          / {dailyValues.fiber}g
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                  {viewByServing && (
                                    <View className="h-2 bg-warm-sand rounded-full overflow-hidden mt-1">
                                      <View
                                        className="h-full bg-dark-sage rounded-full"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            ((recipeData.nutritionalInfo
                                              .fiber || 0) /
                                              servings /
                                              dailyValues.fiber) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </View>
                                  )}
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      </View>
                    )}
                </View>
              )}

              {/* Instructions Tab */}
              {activeTab === "instructions" && (
                <View
                  className={
                    missingFields.includes("steps")
                      ? "border-2 border-dusty-rose rounded-xl p-4"
                      : ""
                  }
                >
                  {/* Edit Mode Header */}
                  {isEditingInstructions ? (
                    <View className="mb-4 flex-row items-center justify-between">
                      <Text className="text-xl font-bold text-charcoal-gray">
                        Edit Instructions
                      </Text>
                      <View className="flex-row gap-2">
                        <RNTouchableOpacity
                          onPress={handleCancelEditInstructions}
                          className="bg-warm-sand rounded-lg px-4 py-2"
                          activeOpacity={0.7}
                        >
                          <Text className="text-charcoal-gray font-semibold">
                            Cancel
                          </Text>
                        </RNTouchableOpacity>
                        <RNTouchableOpacity
                          onPress={handleSaveInstructions}
                          className="bg-dark-sage rounded-lg px-4 py-2"
                          activeOpacity={0.7}
                        >
                          <Text className="text-off-white font-semibold">
                            Save
                          </Text>
                        </RNTouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    canEditRecipe() && (
                      <View className="mb-4 flex-row items-center justify-end">
                        <RNTouchableOpacity
                          onPress={handleStartEditInstructions}
                          className="flex-row items-center bg-soft-beige rounded-lg px-3 py-2"
                          activeOpacity={0.7}
                        >
                          <Pencil size={16} color="#5A6E6C" />
                          <Text className="text-dark-sage font-semibold ml-2">
                            Edit
                          </Text>
                        </RNTouchableOpacity>
                      </View>
                    )
                  )}

                  {/* Edit Mode: Show all steps as editable */}
                  {isEditingInstructions ? (
                    <>
                      {editedSteps.map((step, index) => (
                        <View
                          key={step.id}
                          className="mb-4 bg-soft-beige rounded-xl px-4 py-4"
                        >
                          <View className="flex-row items-start mb-3">
                            <View className="rounded-full w-10 h-10 items-center justify-center mr-4 mt-1 bg-dark-sage">
                              <Text className="text-off-white font-bold text-base">
                                {index + 1}
                              </Text>
                            </View>
                            <View className="flex-1">
                              {/* Step Title Input */}
                              <TextInput
                                value={step.title || ""}
                                onChangeText={(text) =>
                                  handleUpdateStep(
                                    step.id,
                                    "title",
                                    text || undefined
                                  )
                                }
                                placeholder="Step title (optional)"
                                placeholderTextColor="#6B7280"
                                className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-base mb-2"
                                style={{
                                  fontFamily: "Lora_700",
                                }}
                              />
                              {/* Instruction Input */}
                              <TextInput
                                value={step.instruction}
                                onChangeText={(text) =>
                                  handleUpdateStep(step.id, "instruction", text)
                                }
                                placeholder="Enter instruction..."
                                className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-base min-h-[80px]"
                                multiline
                                textAlignVertical="top"
                                style={{ minHeight: 80 }}
                              />
                              {/* Timer Duration Input */}
                              <View className="mt-2 flex-row items-center">
                                <Text className="text-sm text-charcoal-gray/60 mr-2">
                                  Timer (minutes):
                                </Text>
                                <TextInput
                                  value={
                                    step.timerDuration
                                      ? Math.round(
                                          step.timerDuration / 60
                                        ).toString()
                                      : ""
                                  }
                                  onChangeText={(text) => {
                                    const num = parseInt(text, 10);
                                    handleUpdateStep(
                                      step.id,
                                      "timerDuration",
                                      text === ""
                                        ? undefined
                                        : isNaN(num)
                                        ? undefined
                                        : num * 60 // Convert minutes to seconds
                                    );
                                  }}
                                  placeholder="Optional"
                                  placeholderTextColor="#6B7280"
                                  className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                                  keyboardType="number-pad"
                                  style={{ maxWidth: 120 }}
                                />
                              </View>
                            </View>
                            <RNTouchableOpacity
                              onPress={() => handleDeleteStep(step.id)}
                              className="ml-2 w-10 h-10 items-center justify-center"
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              activeOpacity={0.7}
                            >
                              <X
                                size={20}
                                color="#D7B4B3"
                                pointerEvents="none"
                              />
                            </RNTouchableOpacity>
                          </View>
                        </View>
                      ))}
                      <RNTouchableOpacity
                        onPress={handleAddStep}
                        className="bg-dark-sage rounded-xl py-3 px-4 flex-row items-center justify-center mb-4"
                        activeOpacity={0.8}
                      >
                        <Plus size={20} color="#FAF9F7" />
                        <Text className="text-off-white font-semibold ml-2">
                          Add Step
                        </Text>
                      </RNTouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Missing Steps Message */}
                      {missingFields.includes("steps") &&
                        recipeData.steps.length === 0 && (
                          <View className="mb-6 bg-dusty-rose/10 border border-dusty-rose rounded-xl p-4">
                            <Text className="text-dusty-rose font-semibold mb-1">
                              ⚠️ Instructions not detected
                            </Text>
                            <Text className="text-charcoal-gray/70 text-sm">
                              We couldn't extract instructions from the image.
                              Please add them manually using the Edit button.
                            </Text>
                          </View>
                        )}

                      {recipeData.steps.map((step, index) => {
                        const isCompleted = completedSteps.has(step.id);
                        return (
                          <Swipeable
                            key={step.id}
                            ref={(ref) => {
                              if (ref) {
                                swipeableRefs.current[step.id] = ref;
                              }
                            }}
                            renderRightActions={() =>
                              renderSwipeRightAction(step, isCompleted)
                            }
                            onSwipeableWillOpen={() =>
                              handleStepComplete(step.id)
                            }
                            overshootRight={false}
                            friction={2}
                          >
                            <View
                              className={`mb-4 rounded-xl px-4 py-4 ${
                                isCompleted
                                  ? "bg-dark-sage/30 border-2 border-dark-sage"
                                  : "bg-soft-beige"
                              }`}
                              style={{ minHeight: 44 }}
                            >
                              {/* Step Title */}
                              {step.title && (
                                <View className="mb-3">
                                  <Text className="text-lg font-bold text-dark-sage">
                                    {step.title}
                                  </Text>
                                </View>
                              )}

                              <View className="flex-row items-start">
                                <View
                                  className={`rounded-full w-10 h-10 items-center justify-center mr-4 mt-1 ${
                                    isCompleted
                                      ? "bg-dark-sage"
                                      : "bg-dark-sage"
                                  }`}
                                >
                                  {isCompleted ? (
                                    <Check size={20} color="#FAF9F7" />
                                  ) : (
                                    <Text className="text-off-white font-bold text-base">
                                      {index + 1}
                                    </Text>
                                  )}
                                </View>
                                <View className="flex-1">
                                  <Text
                                    className={`text-base leading-6 ${
                                      isCompleted
                                        ? "text-charcoal-gray/60 line-through"
                                        : "text-charcoal-gray"
                                    }`}
                                  >
                                    {enrichInstructionWithAmounts(
                                      step.instruction
                                    )}
                                  </Text>

                                  {/* Timer Component */}
                                  {(() => {
                                    // Parse time from instruction if timerDuration is not set
                                    const parsedDuration =
                                      step.timerDuration ||
                                      parseTimeFromInstruction(
                                        step.instruction
                                      );

                                    if (!parsedDuration) return null;

                                    // Get timer state or use default from parsed duration
                                    const timerState = timerStates[step.id] || {
                                      remaining: parsedDuration,
                                      isRunning: false,
                                      isCompleted: false,
                                      isDismissed: false,
                                    };

                                    return (
                                      <View className="mt-3 -mx-2 bg-white rounded-lg px-3 py-3 border border-warm-sand/50">
                                        <View className="flex-row items-center justify-between">
                                          <View className="flex-row items-center flex-1">
                                            {!timerState.isCompleted &&
                                              !timerState.isDismissed && (
                                                <Clock
                                                  size={16}
                                                  color="#5A6E6C"
                                                  style={{ marginRight: 8 }}
                                                />
                                              )}
                                            <Text className="text-charcoal-gray font-semibold text-base">
                                              {timerState.isDismissed
                                                ? "Done"
                                                : (() => {
                                                    const minutes = Math.floor(
                                                      timerState.remaining / 60
                                                    );
                                                    const seconds =
                                                      timerState.remaining % 60;
                                                    return `${minutes
                                                      .toString()
                                                      .padStart(
                                                        2,
                                                        "0"
                                                      )}:${seconds
                                                      .toString()
                                                      .padStart(2, "0")}`;
                                                  })()}
                                            </Text>
                                          </View>

                                          {!timerState.isCompleted &&
                                            !timerState.isDismissed && (
                                              <View className="flex-row items-center gap-2">
                                                {timerState.isRunning ? (
                                                  <RNTouchableOpacity
                                                    onPress={() => {
                                                      // Pause timer
                                                      if (
                                                        timerIntervals.current[
                                                          step.id
                                                        ]
                                                      ) {
                                                        clearInterval(
                                                          timerIntervals
                                                            .current[step.id]
                                                        );
                                                        delete timerIntervals
                                                          .current[step.id];
                                                      }
                                                      const duration =
                                                        step.timerDuration ||
                                                        parseTimeFromInstruction(
                                                          step.instruction
                                                        ) ||
                                                        0;
                                                      setTimerStates(
                                                        (prev) => ({
                                                          ...prev,
                                                          [step.id]: {
                                                            remaining:
                                                              prev[step.id]
                                                                ?.remaining ||
                                                              duration,
                                                            isRunning: false,
                                                            isCompleted:
                                                              prev[step.id]
                                                                ?.isCompleted ||
                                                              false,
                                                          },
                                                        })
                                                      );
                                                    }}
                                                    className="bg-warm-sand rounded-lg w-10 h-10 items-center justify-center"
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    activeOpacity={0.7}
                                                  >
                                                    <Pause
                                                      size={16}
                                                      color="#3E3E3E"
                                                      pointerEvents="none"
                                                    />
                                                  </RNTouchableOpacity>
                                                ) : (
                                                  <RNTouchableOpacity
                                                    onPress={async () => {
                                                      // Initialize timer state if it doesn't exist
                                                      const duration =
                                                        step.timerDuration ||
                                                        parseTimeFromInstruction(
                                                          step.instruction
                                                        ) ||
                                                        0;
                                                      const currentRemaining =
                                                        timerStates[step.id]
                                                          ?.remaining ||
                                                        duration;

                                                      if (
                                                        currentRemaining <= 0
                                                      ) {
                                                        return;
                                                      }

                                                      // Start timer first (don't wait for notification)
                                                      setTimerStates(
                                                        (prev) => ({
                                                          ...prev,
                                                          [step.id]: {
                                                            remaining:
                                                              currentRemaining,
                                                            isRunning: true,
                                                            isCompleted: false,
                                                          },
                                                        })
                                                      );

                                                      // Schedule notification asynchronously (don't block timer start)
                                                      (async () => {
                                                        try {
                                                          // Request notification permissions
                                                          const { status } =
                                                            await Notifications.requestPermissionsAsync();
                                                          if (
                                                            status !== "granted"
                                                          ) {
                                                            console.log(
                                                              "Notification permission not granted"
                                                            );
                                                            return;
                                                          }

                                                          // Calculate minutes for notification message
                                                          const minutes =
                                                            Math.round(
                                                              currentRemaining /
                                                                60
                                                            );

                                                          // Schedule notification
                                                          // Use timeInterval trigger format
                                                          await Notifications.scheduleNotificationAsync(
                                                            {
                                                              content: {
                                                                title:
                                                                  "Timer Complete!",
                                                                body: `Your BiteBook timer for ${minutes} minute${
                                                                  minutes !== 1
                                                                    ? "s"
                                                                    : ""
                                                                } is done`,
                                                                sound: true,
                                                              },
                                                              trigger: {
                                                                type: "timeInterval",
                                                                seconds:
                                                                  currentRemaining,
                                                                repeats: false,
                                                              } as any,
                                                            }
                                                          );
                                                        } catch (error) {
                                                          console.error(
                                                            "Failed to schedule notification:",
                                                            error
                                                          );
                                                          // Continue with timer even if notification fails
                                                        }
                                                      })();

                                                      // Start interval
                                                      timerIntervals.current[
                                                        step.id
                                                      ] = setInterval(() => {
                                                        setTimerStates(
                                                          (prev) => {
                                                            const current =
                                                              prev[step.id];
                                                            if (!current)
                                                              return prev;

                                                            if (
                                                              current.remaining <=
                                                              1
                                                            ) {
                                                              // Timer completed
                                                              clearInterval(
                                                                timerIntervals
                                                                  .current[
                                                                  step.id
                                                                ]
                                                              );
                                                              delete timerIntervals
                                                                .current[
                                                                step.id
                                                              ];
                                                              return {
                                                                ...prev,
                                                                [step.id]: {
                                                                  remaining: 0,
                                                                  isRunning:
                                                                    false,
                                                                  isCompleted:
                                                                    true,
                                                                },
                                                              };
                                                            }

                                                            return {
                                                              ...prev,
                                                              [step.id]: {
                                                                ...current,
                                                                remaining:
                                                                  current.remaining -
                                                                  1,
                                                              },
                                                            };
                                                          }
                                                        );
                                                      }, 1000);
                                                    }}
                                                    className="bg-dark-sage rounded-lg w-10 h-10 items-center justify-center"
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    activeOpacity={0.7}
                                                  >
                                                    <Play
                                                      size={16}
                                                      color="#FAF9F7"
                                                      pointerEvents="none"
                                                    />
                                                  </RNTouchableOpacity>
                                                )}

                                                <RNTouchableOpacity
                                                  onPress={() => {
                                                    // Reset timer
                                                    if (
                                                      timerIntervals.current[
                                                        step.id
                                                      ]
                                                    ) {
                                                      clearInterval(
                                                        timerIntervals.current[
                                                          step.id
                                                        ]
                                                      );
                                                      delete timerIntervals
                                                        .current[step.id];
                                                    }
                                                    const duration =
                                                      step.timerDuration ||
                                                      parseTimeFromInstruction(
                                                        step.instruction
                                                      ) ||
                                                      0;
                                                    setTimerStates((prev) => ({
                                                      ...prev,
                                                      [step.id]: {
                                                        remaining: duration,
                                                        isRunning: false,
                                                        isCompleted: false,
                                                      },
                                                    }));
                                                    // Cancel notification
                                                    Notifications.cancelAllScheduledNotificationsAsync();
                                                  }}
                                                  className="bg-soft-beige rounded-lg px-3 py-1.5"
                                                  activeOpacity={0.7}
                                                >
                                                  <Text className="text-charcoal-gray text-sm font-semibold">
                                                    Reset
                                                  </Text>
                                                </RNTouchableOpacity>
                                              </View>
                                            )}

                                          {timerState.isCompleted && (
                                            <View className="mt-2">
                                              <View className="bg-dark-sage/20 rounded-lg px-3 py-2 mb-2">
                                                <Text className="text-dark-sage text-xs font-semibold mb-2">
                                                  Timer Complete! Add more time?
                                                </Text>
                                                <View className="flex-row flex-wrap gap-2">
                                                  {[1, 2, 5, 10].map(
                                                    (minutes) => (
                                                      <RNTouchableOpacity
                                                        key={minutes}
                                                        onPress={() => {
                                                          const additionalSeconds =
                                                            minutes * 60;
                                                          startTimer(
                                                            step.id,
                                                            additionalSeconds
                                                          );
                                                        }}
                                                        className="bg-dark-sage rounded-lg px-3 py-1.5"
                                                        activeOpacity={0.7}
                                                      >
                                                        <Text className="text-off-white text-xs font-semibold">
                                                          +{minutes}m
                                                        </Text>
                                                      </RNTouchableOpacity>
                                                    )
                                                  )}
                                                  <RNTouchableOpacity
                                                    onPress={() => {
                                                      setTimerExtensionStepId(
                                                        step.id
                                                      );
                                                      setCustomMinutes("");
                                                    }}
                                                    className="bg-warm-sand rounded-lg px-3 py-1.5"
                                                    activeOpacity={0.7}
                                                  >
                                                    <Text className="text-charcoal-gray text-xs font-semibold">
                                                      Custom
                                                    </Text>
                                                  </RNTouchableOpacity>
                                                  <RNTouchableOpacity
                                                    onPress={() => {
                                                      // Clear any running timer
                                                      if (
                                                        timerIntervals.current[
                                                          step.id
                                                        ]
                                                      ) {
                                                        clearInterval(
                                                          timerIntervals
                                                            .current[step.id]
                                                        );
                                                        delete timerIntervals
                                                          .current[step.id];
                                                      }
                                                      // Cancel notification
                                                      Notifications.cancelAllScheduledNotificationsAsync();
                                                      // Set to dismissed state
                                                      setTimerStates(
                                                        (prev) => ({
                                                          ...prev,
                                                          [step.id]: {
                                                            remaining: 0,
                                                            isRunning: false,
                                                            isCompleted: false,
                                                            isDismissed: true,
                                                          },
                                                        })
                                                      );
                                                    }}
                                                    className="bg-soft-beige rounded-lg px-3 py-1.5"
                                                    activeOpacity={0.7}
                                                  >
                                                    <Text className="text-charcoal-gray text-xs font-semibold">
                                                      Done
                                                    </Text>
                                                  </RNTouchableOpacity>
                                                </View>
                                              </View>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    );
                                  })()}
                                </View>
                              </View>
                            </View>
                          </Swipeable>
                        );
                      })}
                    </>
                  )}

                  {/* Mark as Cooked Button */}
                  <RNTouchableOpacity
                    onPress={() => {
                      // Get recipe ID - check if it's from store or params
                      const dataParam =
                        params.importedData || params.recipeData;
                      let recipeId: string | null = null;

                      if (dataParam) {
                        try {
                          const parsed = JSON.parse(dataParam as string) as
                            | Recipe
                            | RecipeCreateInput;
                          recipeId =
                            "id" in parsed && parsed.id ? parsed.id : null;
                        } catch (e) {
                          console.error(
                            "Failed to parse recipe data for ID:",
                            e
                          );
                        }
                      }

                      // Also check if recipeData has id (if it's a Recipe, not RecipeCreateInput)
                      if (!recipeId && recipeData && "id" in recipeData) {
                        const id = (recipeData as Recipe).id;
                        if (id && typeof id === "string") {
                          recipeId = id;
                        }
                      }

                      if (!recipeId) {
                        Alert.alert(
                          "Error",
                          "Unable to mark recipe as cooked. Recipe ID not found."
                        );
                        return;
                      }

                      // Calculate total time spent (prep time + cook time from steps)
                      const prepTime = recipeData.prepTime || 0;
                      const cookTime =
                        recipeData.steps?.reduce(
                          (sum, step) => sum + (step.timerDuration || 0),
                          0
                        ) || 0;
                      const totalTimeMinutes =
                        prepTime + Math.floor(cookTime / 60);

                      addCookingSession(recipeId, totalTimeMinutes);

                      Alert.alert(
                        "Recipe Marked as Cooked!",
                        "This recipe has been added to your cooking history.",
                        [{ text: "OK" }]
                      );
                    }}
                    className="bg-dark-sage rounded-xl py-4 px-6 items-center justify-center mt-6 mb-6"
                    activeOpacity={0.8}
                  >
                    <View className="flex-row items-center">
                      <ChefHat
                        size={20}
                        color="#FAF9F7"
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-off-white text-base font-semibold">
                        Mark as Cooked
                      </Text>
                    </View>
                  </RNTouchableOpacity>
                </View>
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
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-2xl font-bold text-charcoal-gray">
                    Tags
                  </Text>
                  <RNTouchableOpacity
                    onPress={() => {
                      setShowAddTagInput(!showAddTagInput);
                      if (!showAddTagInput) {
                        setNewTag("");
                      }
                    }}
                    className="bg-dark-sage rounded-full px-4 py-2 flex-row items-center"
                    activeOpacity={0.8}
                  >
                    <Plus
                      size={16}
                      color="#FAF9F7"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-off-white text-sm font-semibold">
                      {showAddTagInput ? "Cancel" : "Add Custom"}
                    </Text>
                  </RNTouchableOpacity>
                </View>

                {/* Auto-generated Tags (read-only) */}
                {originalTags.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row flex-wrap">
                      {originalTags.map((tag, index) => (
                        <View
                          key={index}
                          className="bg-warm-sand rounded-full px-4 py-2 mr-2 mb-2"
                          style={{ minHeight: 44, justifyContent: "center" }}
                        >
                          <Text className="text-charcoal-gray text-sm">
                            {tag}
                          </Text>
                        </View>
                      ))}
                      {customTags.map((tag, index) => (
                        <RNTouchableOpacity
                          key={index}
                          onPress={() => {
                            // Remove custom tag
                            const updatedTags = recipeData.tags.filter(
                              (t) => t !== tag
                            );
                            const updatedRecipeData = {
                              ...recipeData,
                              tags: updatedTags,
                            };
                            setRecipeData(updatedRecipeData);

                            // Update in store if recipe exists
                            if (
                              "id" in recipeData &&
                              recipeData.id &&
                              typeof recipeData.id === "string"
                            ) {
                              updateRecipe(
                                recipeData.id,
                                {
                                  tags: updatedTags,
                                },
                                user?.defaultKitchenId
                              );
                            }
                          }}
                          className="bg-warm-sand rounded-full px-4 py-2 mr-2 mb-2 flex-row items-center"
                          activeOpacity={0.7}
                          style={{
                            minHeight: 44,
                            justifyContent: "center",
                          }}
                        >
                          <Text className="text-charcoal-gray text-sm mr-2">
                            {tag}
                          </Text>
                          <X size={14} color="#3E3E3E" pointerEvents="none" />
                        </RNTouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Add Custom Tag Input (shown when "Add Custom" is clicked) */}
                {showAddTagInput && (
                  <View className="flex-row gap-2">
                    <TextInput
                      className="flex-1 bg-soft-beige rounded-xl px-4 py-3 text-charcoal-gray text-base"
                      placeholder="Ex: Grandma's Recipe"
                      placeholderTextColor="#9CA3AF"
                      value={newTag}
                      onChangeText={setNewTag}
                      onSubmitEditing={() => {
                        if (newTag.trim()) {
                          const trimmedTag = newTag.trim();
                          const currentTags = recipeData.tags || [];

                          // Don't add duplicate tags
                          if (!currentTags.includes(trimmedTag)) {
                            const updatedTags = [...currentTags, trimmedTag];
                            const updatedRecipeData = {
                              ...recipeData,
                              tags: updatedTags,
                            };
                            setRecipeData(updatedRecipeData);
                            setNewTag("");
                            setShowAddTagInput(false);

                            // Update in store if recipe exists
                            if (
                              "id" in recipeData &&
                              recipeData.id &&
                              typeof recipeData.id === "string"
                            ) {
                              updateRecipe(
                                recipeData.id,
                                {
                                  tags: updatedTags,
                                },
                                user?.defaultKitchenId
                              );
                            }
                          } else {
                            setNewTag("");
                          }
                        }
                      }}
                      returnKeyType="done"
                      style={{ minHeight: 44 }}
                      autoFocus
                    />
                    <RNTouchableOpacity
                      onPress={() => {
                        if (newTag.trim()) {
                          const trimmedTag = newTag.trim();
                          const currentTags = recipeData.tags || [];

                          // Don't add duplicate tags
                          if (!currentTags.includes(trimmedTag)) {
                            const updatedTags = [...currentTags, trimmedTag];
                            const updatedRecipeData = {
                              ...recipeData,
                              tags: updatedTags,
                            };
                            setRecipeData(updatedRecipeData);
                            setNewTag("");
                            setShowAddTagInput(false);

                            // Update in store if recipe exists
                            if (
                              "id" in recipeData &&
                              recipeData.id &&
                              typeof recipeData.id === "string"
                            ) {
                              updateRecipe(
                                recipeData.id,
                                {
                                  tags: updatedTags,
                                },
                                user?.defaultKitchenId
                              );
                            }
                          } else {
                            setNewTag("");
                          }
                        }
                      }}
                      className="bg-dark-sage rounded-xl px-6 py-3 items-center justify-center"
                      activeOpacity={0.8}
                      style={{ minHeight: 44 }}
                      disabled={!newTag.trim()}
                    >
                      <Text className="text-off-white text-base font-semibold">
                        Add
                      </Text>
                    </RNTouchableOpacity>
                  </View>
                )}
              </View>

              {/* Save Button (for imported recipes) */}
              {isImported && (
                <RNTouchableOpacity
                  className="bg-dark-sage rounded-xl py-4 items-center justify-center mb-8"
                  activeOpacity={0.8}
                  onPress={() => {
                    // Check if user is authenticated
                    if (!user) {
                      setShowAuthPrompt(true);
                      return;
                    }
                    // TODO: Implement save to Firestore
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

        {/* Menu Modal */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <RNTouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View
              className="bg-off-white rounded-2xl p-4"
              style={{ width: "80%", maxWidth: 300 }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-charcoal-gray">
                  Recipe Options
                </Text>
                <RNTouchableOpacity
                  onPress={() => setShowMenu(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={24} color="#3E3E3E" />
                </RNTouchableOpacity>
              </View>

              <RNTouchableOpacity
                onPress={handleShare}
                className="flex-row items-center py-4 border-b border-soft-beige"
                activeOpacity={0.7}
              >
                <Share2 size={20} color="#5A6E6C" style={{ marginRight: 12 }} />
                <Text className="text-charcoal-gray text-base font-semibold">
                  Share Recipe
                </Text>
              </RNTouchableOpacity>

              <RNTouchableOpacity
                onPress={() => {
                  setShowMenu(false);
                  // Pass the recipe ID as a parameter when navigating
                  const recipeId = params.id as string;
                  if (recipeId) {
                    router.push(`/(tabs)/meal-plan?recipeId=${recipeId}`);
                  } else {
                    router.push("/(tabs)/meal-plan");
                  }
                }}
                className="flex-row items-center py-4 border-b border-soft-beige"
                activeOpacity={0.7}
              >
                <Calendar
                  size={20}
                  color="#5A6E6C"
                  style={{ marginRight: 12 }}
                />
                <Text className="text-charcoal-gray text-base font-semibold">
                  Add to Calendar
                </Text>
              </RNTouchableOpacity>

              <RNTouchableOpacity
                onPress={handleDelete}
                className="flex-row items-center py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={20} color="#DC2626" style={{ marginRight: 12 }} />
                <Text className="text-red-600 text-base font-semibold">
                  Delete Recipe
                </Text>
              </RNTouchableOpacity>
            </View>
          </RNTouchableOpacity>
        </Modal>

        {/* Book Selector Modal */}
        <Modal
          visible={showBookSelector}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBookSelector(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              className="bg-off-white rounded-t-3xl"
              style={{ maxHeight: "70%", paddingBottom: 40 }}
            >
              <View className="flex-row items-center justify-between px-6 py-4 border-b border-soft-beige">
                <Text className="text-xl font-bold text-charcoal-gray">
                  Select a Book
                </Text>
                <RNTouchableOpacity
                  onPress={() => setShowBookSelector(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={24} color="#3E3E3E" pointerEvents="none" />
                </RNTouchableOpacity>
              </View>

              <FlatList
                data={books}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => (
                  <RNTouchableOpacity
                    onPress={() => handleAddToBook(item.id)}
                    className="flex-row items-center px-6 py-4 border-b border-soft-beige"
                    activeOpacity={0.7}
                  >
                    <BookOpen
                      size={20}
                      color="#5A6E6C"
                      style={{ marginRight: 12 }}
                    />
                    <View className="flex-1">
                      <Text className="text-charcoal-gray text-base font-semibold">
                        {decodeHtmlEntities(item.name)}
                      </Text>
                      {item.description && (
                        <Text className="text-charcoal-gray/60 text-sm mt-1">
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </RNTouchableOpacity>
                )}
                ListEmptyComponent={
                  <View className="px-6 py-8 items-center">
                    <Text className="text-charcoal-gray/60 text-base">
                      No recipe books yet
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </View>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onSuccess={() => {
          // Retry the save after successful auth
          if (isImported && recipeData) {
            // TODO: Implement save to Firestore
            Alert.alert("Success", "Recipe saved!");
          }
        }}
        message="Please sign in to save recipes"
      />

      {/* Custom Timer Extension Modal */}
      <Modal
        visible={timerExtensionStepId !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTimerExtensionStepId(null);
          setCustomMinutes("");
        }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View className="bg-off-white rounded-xl p-6 w-full max-w-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-charcoal-gray">
                Add Custom Time
              </Text>
              <RNTouchableOpacity
                onPress={() => {
                  setTimerExtensionStepId(null);
                  setCustomMinutes("");
                }}
                className="w-11 h-11 items-center justify-center"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={20} color="#3E3E3E" pointerEvents="none" />
              </RNTouchableOpacity>
            </View>
            <Text className="text-charcoal-gray/70 text-sm mb-4">
              Enter the number of minutes to add to the timer:
            </Text>
            <TextInput
              value={customMinutes}
              onChangeText={setCustomMinutes}
              placeholder="e.g., 15"
              keyboardType="number-pad"
              className="bg-white border border-warm-sand rounded-lg px-4 py-3 text-charcoal-gray text-base mb-4"
              autoFocus
            />
            <View className="flex-row gap-3">
              <RNTouchableOpacity
                onPress={() => {
                  setTimerExtensionStepId(null);
                  setCustomMinutes("");
                }}
                className="flex-1 bg-soft-beige rounded-lg py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-charcoal-gray font-semibold">Cancel</Text>
              </RNTouchableOpacity>
              <RNTouchableOpacity
                onPress={() => {
                  const minutes = parseFloat(customMinutes);
                  if (!isNaN(minutes) && minutes > 0 && timerExtensionStepId) {
                    const additionalSeconds = Math.round(minutes * 60);
                    startTimer(timerExtensionStepId, additionalSeconds);
                    setTimerExtensionStepId(null);
                    setCustomMinutes("");
                  }
                }}
                className="flex-1 bg-dark-sage rounded-lg py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-off-white font-semibold">Add Time</Text>
              </RNTouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

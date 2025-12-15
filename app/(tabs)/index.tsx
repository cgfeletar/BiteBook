import { RecipeCard } from "@/components/RecipeCard";
import { FilterModal, FilterState } from "@/components/FilterModal";
import "@/nativewind-setup";
import { usePantryStore } from "@/src/store/usePantryStore";
import { useProgressStore } from "@/src/store/useProgressStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { Recipe } from "@/src/types";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import { ChevronDown, Filter, Search, User } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SortOption = "recent" | "prepTime" | "cookTime" | "rating" | "pantryMatch";

// Dummy recipe data matching the Recipe interface
const dummyRecipes: Recipe[] = [
  {
    id: "1",
    title: "Creamy Mushroom Pasta",
    coverImage:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400",
    ingredients: [
      { name: "Pasta", quantity: 400, unit: "g", isChecked: false },
      { name: "Mushrooms", quantity: 300, unit: "g", isChecked: false },
      { name: "Heavy Cream", quantity: 200, unit: "ml", isChecked: false },
    ],
    steps: [
      {
        id: "1",
        instruction: "Cook pasta according to package directions",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "2",
        instruction: "Sauté mushrooms until golden",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "3",
        instruction: "Add cream and simmer",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
    ],
    nutritionalInfo: {
      calories: 450,
      protein: 15,
      carbohydrates: 60,
      fat: 18,
    },
    sourceUrl: "https://example.com/recipe1",
    originalAuthor: "Chef John",
    tags: ["pasta", "vegetarian", "comfort-food"],
    categoryIds: ["cat1", "cat2"],
    createdAt: Timestamp.now(),
  },
  {
    id: "2",
    title: "Classic Chocolate Chip Cookies",
    coverImage:
      "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400",
    ingredients: [
      { name: "Flour", quantity: 2.5, unit: "cups", isChecked: false },
      { name: "Butter", quantity: 1, unit: "cup", isChecked: false },
      { name: "Chocolate Chips", quantity: 2, unit: "cups", isChecked: false },
      { name: "Sugar", quantity: 0.75, unit: "cup", isChecked: false },
    ],
    steps: [
      {
        id: "1",
        instruction: "Cream butter and sugars together",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "2",
        instruction: "Mix in eggs and vanilla",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "3",
        instruction: "Bake at 375°F for 10-12 minutes",
        isCompleted: false,
        isBeginnerFriendly: true,
        timerDuration: 660,
      },
    ],
    nutritionalInfo: {
      calories: 120,
      protein: 1.5,
      carbohydrates: 16,
      fat: 6,
    },
    sourceUrl: "https://example.com/recipe2",
    originalAuthor: "Grandma's Recipe",
    tags: ["dessert", "baking", "sweet"],
    categoryIds: ["cat3"],
    createdAt: Timestamp.now(),
  },
  {
    id: "3",
    title: "Mediterranean Quinoa Bowl",
    coverImage:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400",
    ingredients: [
      { name: "Quinoa", quantity: 1, unit: "cup", isChecked: false },
      { name: "Cherry Tomatoes", quantity: 200, unit: "g", isChecked: false },
      { name: "Cucumber", quantity: 1, unit: "medium", isChecked: false },
      { name: "Feta Cheese", quantity: 100, unit: "g", isChecked: false },
    ],
    steps: [
      {
        id: "1",
        instruction: "Cook quinoa and let cool",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "2",
        instruction: "Dice vegetables",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "3",
        instruction: "Toss everything together with olive oil",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
    ],
    nutritionalInfo: {
      calories: 320,
      protein: 12,
      carbohydrates: 45,
      fat: 10,
      fiber: 6,
    },
    sourceUrl: "https://example.com/recipe3",
    originalAuthor: "Healthy Eats",
    tags: ["healthy", "vegetarian", "mediterranean"],
    categoryIds: ["cat1", "cat4"],
    createdAt: Timestamp.now(),
  },
  {
    id: "4",
    title: "Spicy Thai Green Curry",
    coverImage:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400",
    ingredients: [
      { name: "Chicken", quantity: 500, unit: "g", isChecked: false },
      {
        name: "Green Curry Paste",
        quantity: 3,
        unit: "tbsp",
        isChecked: false,
      },
      { name: "Coconut Milk", quantity: 400, unit: "ml", isChecked: false },
      { name: "Thai Basil", quantity: 1, unit: "cup", isChecked: false },
    ],
    steps: [
      {
        id: "1",
        instruction: "Heat curry paste in a pan",
        isCompleted: false,
        isBeginnerFriendly: false,
      },
      {
        id: "2",
        instruction: "Add coconut milk and bring to a simmer",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "3",
        instruction: "Add chicken and cook until done",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
    ],
    nutritionalInfo: {
      calories: 380,
      protein: 28,
      carbohydrates: 12,
      fat: 24,
    },
    sourceUrl: "https://example.com/recipe4",
    originalAuthor: "Thai Kitchen",
    tags: ["thai", "spicy", "curry"],
    categoryIds: ["cat2"],
    createdAt: Timestamp.now(),
  },
  {
    id: "5",
    title: "Avocado Toast with Poached Eggs",
    coverImage:
      "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400",
    ingredients: [
      {
        name: "Sourdough Bread",
        quantity: 2,
        unit: "slices",
        isChecked: false,
      },
      { name: "Avocado", quantity: 1, unit: "large", isChecked: false },
      { name: "Eggs", quantity: 2, unit: "large", isChecked: false },
      {
        name: "Red Pepper Flakes",
        quantity: 1,
        unit: "pinch",
        isChecked: false,
      },
    ],
    steps: [
      {
        id: "1",
        instruction: "Toast bread until golden",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "2",
        instruction: "Mash avocado with lemon and salt",
        isCompleted: false,
        isBeginnerFriendly: true,
      },
      {
        id: "3",
        instruction: "Poach eggs in simmering water",
        isCompleted: false,
        isBeginnerFriendly: false,
        timerDuration: 180,
      },
    ],
    nutritionalInfo: {
      calories: 420,
      protein: 18,
      carbohydrates: 35,
      fat: 22,
    },
    sourceUrl: "https://example.com/recipe5",
    originalAuthor: "Brunch Lover",
    tags: ["breakfast", "brunch", "healthy"],
    categoryIds: ["cat1"],
    createdAt: Timestamp.now(),
  },
  {
    id: "6",
    title: "Beef Bourguignon",
    coverImage:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400",
    ingredients: [
      { name: "Beef Chuck", quantity: 1.5, unit: "kg", isChecked: false },
      { name: "Red Wine", quantity: 750, unit: "ml", isChecked: false },
      { name: "Carrots", quantity: 3, unit: "large", isChecked: false },
      { name: "Onions", quantity: 2, unit: "medium", isChecked: false },
    ],
    steps: [
      {
        id: "1",
        instruction: "Marinate beef in wine overnight",
        isCompleted: false,
        isBeginnerFriendly: false,
      },
      {
        id: "2",
        instruction: "Brown beef in a Dutch oven",
        isCompleted: false,
        isBeginnerFriendly: false,
      },
      {
        id: "3",
        instruction: "Slow cook for 3 hours",
        isCompleted: false,
        isBeginnerFriendly: true,
        timerDuration: 10800,
      },
    ],
    nutritionalInfo: {
      calories: 520,
      protein: 42,
      carbohydrates: 15,
      fat: 28,
    },
    sourceUrl: "https://example.com/recipe6",
    originalAuthor: "Julia Child",
    tags: ["french", "comfort-food", "slow-cooked"],
    categoryIds: ["cat2"],
    createdAt: Timestamp.now(),
  },
];

export default function RecipeFeed() {
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    mealTypes: [],
    cuisines: [],
    cookedBefore: "all",
    dietary: [],
    minRating: null,
    sourceTypes: [],
    nutritional: [],
    customTags: [],
  });
  const recipes = useRecipeStore((state) => state.recipes);
  const pantryItems = usePantryStore((state) => state.items);
  const cookingSessions = useProgressStore((state) => state.cookingSessions);

  // Helper function to calculate pantry match percentage
  const calculatePantryMatch = (recipe: Recipe): number => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return 0;
    }

    // Create a set of pantry item names (normalized to lowercase)
    const pantryNames = new Set(
      pantryItems.map((item) => item.name.toLowerCase().trim())
    );

    // Count how many recipe ingredients are in the pantry
    const matchingIngredients = recipe.ingredients.filter((ingredient) => {
      const ingredientName = ingredient.name.toLowerCase().trim();
      return pantryNames.has(ingredientName);
    });

    // Return percentage (0-100)
    return (matchingIngredients.length / recipe.ingredients.length) * 100;
  };

  // Get cooked recipe IDs
  const cookedRecipeIds = useMemo(
    () => new Set(cookingSessions.map((s) => s.recipeId)),
    [cookingSessions]
  );

  // Filter and sort recipes
  const filteredAndSortedRecipes = useMemo(() => {
    const allRecipes = recipes.length > 0 ? recipes : dummyRecipes;

    // Apply advanced filters
    let filtered = allRecipes.filter((recipe) => {
      const recipeTags = recipe.tags?.map((t) => t.toLowerCase()) || [];

      // Meal type filter
      if (filters.mealTypes.length > 0) {
        const hasMealType = filters.mealTypes.some((type) =>
          recipeTags.some((tag) => tag.includes(type.toLowerCase()))
        );
        if (!hasMealType) return false;
      }

      // Cuisine filter
      if (filters.cuisines.length > 0) {
        const hasCuisine = filters.cuisines.some((cuisine) =>
          recipeTags.some((tag) => tag.includes(cuisine.toLowerCase()))
        );
        if (!hasCuisine) return false;
      }

      // Cooked before filter
      if (filters.cookedBefore !== "all") {
        const isCooked = cookedRecipeIds.has(recipe.id);
        if (filters.cookedBefore === "cooked" && !isCooked) return false;
        if (filters.cookedBefore === "not-cooked" && isCooked) return false;
      }

      // Dietary filter
      if (filters.dietary.length > 0) {
        const hasDietary = filters.dietary.some((diet) =>
          recipeTags.some((tag) => tag.includes(diet.toLowerCase()))
        );
        if (!hasDietary) return false;
      }

      // Rating filter
      if (filters.minRating !== null) {
        const rating = recipe.rating || 0;
        if (rating < filters.minRating) return false;
      }

      // Source type filter
      if (filters.sourceTypes.length > 0) {
        const sourceUrl = recipe.sourceUrl?.toLowerCase() || "";
        const matchesSourceType = filters.sourceTypes.some((sourceType) => {
          switch (sourceType) {
            case "tiktok":
              return sourceUrl.includes("tiktok.com") || sourceUrl.includes("vm.tiktok");
            case "instagram":
              return sourceUrl.includes("instagram.com") || sourceUrl.includes("instagr.am");
            case "pinterest":
              return sourceUrl.includes("pinterest.com") || sourceUrl.includes("pin.it");
            case "youtube":
              return sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
            case "blog":
              return (
                sourceUrl.includes("blog") ||
                sourceUrl.includes("wordpress") ||
                sourceUrl.includes("blogspot") ||
                sourceUrl.includes("medium.com")
              );
            case "website":
              return (
                !sourceUrl.includes("tiktok") &&
                !sourceUrl.includes("instagram") &&
                !sourceUrl.includes("pinterest") &&
                !sourceUrl.includes("youtube") &&
                !sourceUrl.includes("blog") &&
                !sourceUrl.includes("wordpress") &&
                !sourceUrl.includes("blogspot") &&
                !sourceUrl.includes("medium.com")
              );
            default:
              return false;
          }
        });
        if (!matchesSourceType) return false;
      }

      // Nutritional content filter
      if (filters.nutritional.length > 0) {
        const nutrition = recipe.nutritionalInfo || {};
        const matchesNutritional = filters.nutritional.every((filterId) => {
          switch (filterId) {
            case "low-fat":
              return nutrition.fat !== undefined && nutrition.fat <= 3;
            case "high-protein":
              return nutrition.protein !== undefined && nutrition.protein >= 10;
            case "high-fiber":
              return nutrition.fiber !== undefined && nutrition.fiber >= 3;
            case "low-sodium":
              return nutrition.sodium !== undefined && nutrition.sodium <= 140;
            case "low-sugar":
              return nutrition.sugar !== undefined && nutrition.sugar <= 5;
            case "low-calorie":
              return nutrition.calories !== undefined && nutrition.calories <= 200;
            default:
              return false;
          }
        });
        if (!matchesNutritional) return false;
      }

      // Custom tags filter
      if (filters.customTags.length > 0) {
        const recipeTags = recipe.tags?.map((t) => t) || [];
        const hasCustomTag = filters.customTags.some((filterTag) =>
          recipeTags.includes(filterTag)
        );
        if (!hasCustomTag) return false;
      }

      return true;
    });

    // Then, sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "recent":
          // Most recent first (newest createdAt)
          const aTime =
            a.createdAt instanceof Timestamp
              ? a.createdAt.toMillis()
              : a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : 0;
          const bTime =
            b.createdAt instanceof Timestamp
              ? b.createdAt.toMillis()
              : b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : 0;
          return bTime - aTime;

        case "prepTime":
          // Shortest prep time first
          const aPrep = a.prepTime ?? Infinity;
          const bPrep = b.prepTime ?? Infinity;
          return aPrep - bPrep;

        case "cookTime":
          // Shortest cook time first
          const aCook =
            a.steps?.reduce(
              (sum, step) => sum + (step.timerDuration || 0),
              0
            ) || Infinity;
          const bCook =
            b.steps?.reduce(
              (sum, step) => sum + (step.timerDuration || 0),
              0
            ) || Infinity;
          return aCook - bCook;

        case "rating":
          // Highest rated first
          const aRating = a.rating ?? 0;
          const bRating = b.rating ?? 0;
          return bRating - aRating;

        case "pantryMatch":
          // Highest pantry match percentage first
          const aMatch = calculatePantryMatch(a);
          const bMatch = calculatePantryMatch(b);
          return bMatch - aMatch;

        default:
          return 0;
      }
    });

    return sorted;
  }, [recipes, sortOption, pantryItems, filters, cookedRecipeIds]);

  // Determine number of columns based on screen width
  const isTablet = width >= 768;
  const numColumns = isTablet ? (width >= 1024 ? 4 : 3) : 2;

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleRecipePress = (recipe: Recipe) => {
    // Navigate to recipe detail screen with recipe data
    router.push({
      pathname: "/recipe-detail",
      params: {
        recipeData: JSON.stringify(recipe),
      },
    });
  };

  const handleFavoritePress = (recipeId: string) => {
    // TODO: Implement favorite functionality
    console.log("Favorite toggled for recipe:", recipeId);
  };

  // Calculate item width for grid layout
  const itemWidth = (width - 48 - (numColumns - 1) * 12) / numColumns; // 48 = horizontal padding (24*2), 12 = gap between items

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FAF9F7" }}
      className="flex-1 bg-off-white"
      edges={["top", "bottom"]}
    >
      <View style={{ flex: 1 }} className="flex-1">
        {/* Header Row */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
          <Text
            className="text-2xl font-bold text-charcoal"
            style={{ fontFamily: "Lora_700Bold" }}
          >
            What are we making?
          </Text>
          <TouchableOpacity
            className="bg-redwood rounded-full w-10 h-10 items-center justify-center"
            activeOpacity={0.7}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <User size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-6 mb-4">
          <View className="bg-white rounded-xl flex flex-row items-center px-4 py-3">
            <Search size={18} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 mb-[4px] text-charcoal text-base"
              placeholder="Search recipes..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Sort Dropdown */}
        <View className="px-6 mb-4">
          {(showSortDropdown || false) && (
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
              }}
              onPress={() => setShowSortDropdown(false)}
            />
          )}
          <View
            className="flex-row items-center gap-3"
            style={{ zIndex: showSortDropdown ? 100 : 1 }}
          >
            <View className="flex-1 flex-row items-center">
              <View className="flex-1">
                <TouchableOpacity
                  onPress={() => {
                    setShowSortDropdown(!showSortDropdown);
                  }}
                  className="bg-soft-beige rounded-xl px-4 py-3 flex-row items-center justify-between"
                  activeOpacity={0.7}
                  style={{ minHeight: 44 }}
                >
                  <Text className="text-charcoal-gray font-semibold text-sm">
                    {sortOption === "recent"
                      ? "Most Recent"
                      : sortOption === "prepTime"
                      ? "Shortest Prep Time"
                      : sortOption === "cookTime"
                      ? "Shortest Cook Time"
                      : sortOption === "rating"
                      ? "Highest Rated"
                      : "Best Pantry Match"}
                  </Text>
                  <ChevronDown
                    size={18}
                    color="#3E3E3E"
                    style={{
                      transform: [
                        { rotate: showSortDropdown ? "180deg" : "0deg" },
                      ],
                    }}
                  />
                </TouchableOpacity>
                {showSortDropdown && (
                  <View className="absolute top-full left-0 right-0 mt-1 bg-off-white rounded-xl shadow-lg border border-warm-sand/50 overflow-hidden z-50">
                    <TouchableOpacity
                      onPress={() => {
                        setSortOption("recent");
                        setShowSortDropdown(false);
                      }}
                      className={`px-4 py-3 ${
                        sortOption === "recent" ? "bg-dark-sage" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          sortOption === "recent"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Most Recent
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSortOption("prepTime");
                        setShowSortDropdown(false);
                      }}
                      className={`px-4 py-3 ${
                        sortOption === "prepTime" ? "bg-dark-sage" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          sortOption === "prepTime"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Shortest Prep Time
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSortOption("cookTime");
                        setShowSortDropdown(false);
                      }}
                      className={`px-4 py-3 ${
                        sortOption === "cookTime" ? "bg-dark-sage" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          sortOption === "cookTime"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Shortest Cook Time
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSortOption("rating");
                        setShowSortDropdown(false);
                      }}
                      className={`px-4 py-3 ${
                        sortOption === "rating" ? "bg-dark-sage" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          sortOption === "rating"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Highest Rated
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSortOption("pantryMatch");
                        setShowSortDropdown(false);
                      }}
                      className={`px-4 py-3 ${
                        sortOption === "pantryMatch" ? "bg-dark-sage" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          sortOption === "pantryMatch"
                            ? "text-off-white"
                            : "text-charcoal-gray"
                        }`}
                      >
                        Best Pantry Match
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Filter Icon */}
            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              className={`rounded-xl items-center justify-center ${
                (filters.mealTypes.length > 0 ||
                  filters.cuisines.length > 0 ||
                  filters.cookedBefore !== "all" ||
                  filters.dietary.length > 0 ||
                  filters.minRating !== null ||
                  filters.sourceTypes.length > 0 ||
                  filters.nutritional.length > 0 ||
                  filters.customTags.length > 0)
                  ? "bg-dark-sage"
                  : "bg-soft-beige"
              }`}
              activeOpacity={0.7}
              style={{ width: 44, height: 44 }}
            >
              <Filter
                size={20}
                color={
                  filters.mealTypes.length > 0 ||
                  filters.cuisines.length > 0 ||
                  filters.cookedBefore !== "all" ||
                  filters.dietary.length > 0 ||
                  filters.minRating !== null ||
                  filters.sourceTypes.length > 0 ||
                  filters.nutritional.length > 0 ||
                  filters.customTags.length > 0
                    ? "#FAF9F7"
                    : "#3E3E3E"
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content - Recipe Grid */}
        <FlatList
          data={filteredAndSortedRecipes}
          numColumns={numColumns}
          renderItem={({ item, index }) => {
            const isLastInRow = (index + 1) % numColumns === 0;
            return (
              <View
                style={{
                  width: itemWidth,
                  marginRight: isLastInRow ? 12 : 12,
                  marginBottom: 12,
                }}
              >
                <RecipeCard
                  recipe={item}
                  onPress={() => handleRecipePress(item)}
                  onFavoritePress={() => handleFavoritePress(item.id)}
                />
              </View>
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#5A6E6C"
            />
          }
        />
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={setFilters}
        currentFilters={filters}
        recipes={recipes.length > 0 ? recipes : dummyRecipes}
      />
    </SafeAreaView>
  );
}

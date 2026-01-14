import "@/nativewind-setup";
import { RecipeCard } from "@/components/RecipeCard";
import { useRecipeBooksStore } from "@/src/store/useRecipeBooksStore";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useWindowDimensions, View, Text, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function BookDetailScreen() {
  const params = useLocalSearchParams();
  const bookId = params.bookId as string;
  const { width } = useWindowDimensions();
  const books = useRecipeBooksStore((state) => state.books);
  const getRecipesInBook = useRecipeBooksStore((state) => state.getRecipesInBook);
  
  const book = books.find((b) => b.id === bookId);
  const recipes = book ? getRecipesInBook(bookId) : [];

  const isTablet = width >= 768;
  const numColumns = isTablet ? (width >= 1024 ? 4 : 3) : 2;
  const itemWidth = (width - 24 - (numColumns - 1) * 12) / numColumns;

  const handleRecipePress = (recipe: any) => {
    router.push({
      pathname: "/recipe-detail",
      params: {
        recipeData: JSON.stringify(recipe),
      },
    });
  };

  if (!book) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-charcoal-gray text-base">
              Book not found
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
        <View className="flex-1">
          {/* Header */}
          <View className="px-6 pt-4 pb-4 border-b border-soft-beige">
            <View className="flex-row items-center mb-2">
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                style={{ width: 44, height: 44, justifyContent: "center", marginRight: 12 }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={24} color="#3E3E3E" pointerEvents="none" />
              </TouchableOpacity>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-charcoal-gray">
                  {book.name}
                </Text>
                {book.description && (
                  <Text className="text-charcoal-gray/60 text-sm mt-1">
                    {book.description}
                  </Text>
                )}
              </View>
            </View>
            <Text className="text-charcoal-gray/60 text-sm ml-14">
              {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {/* Recipes Grid */}
          {recipes.length > 0 ? (
            <FlatList
              data={recipes}
              numColumns={numColumns}
              renderItem={({ item, index }) => {
                const isLastInRow = (index + 1) % numColumns === 0;
                return (
                  <View
                    style={{
                      width: itemWidth,
                      marginRight: isLastInRow ? 0 : 12,
                      marginBottom: 12,
                    }}
                  >
                    <RecipeCard
                      recipe={item}
                      onPress={() => handleRecipePress(item)}
                      onFavoritePress={() => {}}
                    />
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 120 }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-charcoal-gray/60 text-base text-center">
                No recipes in this book yet
              </Text>
              <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                Add recipes from the recipe detail screen
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}


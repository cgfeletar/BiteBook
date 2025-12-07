import "@/nativewind-setup";
import { useRecipeBooksStore } from "@/src/store/useRecipeBooksStore";
import { router } from "expo-router";
import { BookOpen, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

export default function RecipeBooksScreen() {
  const { width } = useWindowDimensions();
  const books = useRecipeBooksStore((state) => state.books);
  const addBook = useRecipeBooksStore((state) => state.addBook);
  const deleteBook = useRecipeBooksStore((state) => state.deleteBook);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");

  const isTablet = width >= 768;
  const numColumns = isTablet ? (width >= 1024 ? 3 : 2) : 2;
  const itemWidth = (width - 48 - (numColumns - 1) * 12) / numColumns; // 48 = horizontal padding (24*2), 12 = gap

  const handleAddBook = () => {
    if (!newBookName.trim()) return;

    addBook({
      name: newBookName.trim(),
      description: newBookDescription.trim() || undefined,
      recipeIds: [],
    });

    setNewBookName("");
    setNewBookDescription("");
    setShowAddForm(false);
  };

  const handleBookPress = (bookId: string) => {
    // TODO: Navigate to book detail screen showing recipes in that book
    router.push({
      pathname: "/book-detail",
      params: { bookId },
    });
  };

  const renderBookCard = ({ item, index }: { item: any; index: number }) => {
    const isLastInRow = (index + 1) % numColumns === 0;

    return (
      <TouchableOpacity
        onPress={() => handleBookPress(item.id)}
        activeOpacity={0.9}
        style={{
          width: itemWidth,
          marginRight: isLastInRow ? 0 : 12,
          marginBottom: 12,
        }}
      >
        <View className="bg-soft-beige rounded-xl overflow-hidden shadow-sm">
          {/* Cover Image or Icon */}
          {item.coverImage ? (
            <Image
              source={{ uri: item.coverImage }}
              style={{ width: "100%", aspectRatio: 1.2 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View className="bg-warm-sand w-full aspect-[1.2] items-center justify-center">
              <BookOpen size={48} color="#5A6E6C" />
            </View>
          )}

          {/* Content */}
          <View className="p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-2">
                <Text
                  className="text-charcoal-gray font-bold text-lg mb-1"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.description && (
                  <Text
                    className="text-charcoal-gray/60 text-sm"
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}
                <Text className="text-charcoal-gray/40 text-xs mt-2">
                  {item.recipeIds.length} recipe
                  {item.recipeIds.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-off-white"
      edges={["top", "bottom"]}
    >
      <View className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 pb-4">
          <Text className="text-2xl font-bold text-charcoal-gray">
            My Recipe Books
          </Text>
          <Text className="text-charcoal-gray/60 text-sm mt-1">
            Organize your recipes into collections
          </Text>
        </View>

        {/* Books Grid */}
        <FlatList
          data={books}
          renderItem={renderBookCard}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-12 px-6">
              <BookOpen size={48} color="#9CA3AF" />
              <Text className="text-charcoal-gray/60 text-base text-center mt-4">
                No recipe books yet
              </Text>
              <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                Create your first book to organize recipes
              </Text>
            </View>
          }
        />

        {/* Add Book Form */}
        {showAddForm && (
          <View className="absolute bottom-0 left-0 right-0 bg-off-white border-t border-soft-beige px-6 py-4">
            <Text className="text-lg font-bold text-charcoal-gray mb-4">
              New Recipe Book
            </Text>
            <View className="mb-3">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Book Name
              </Text>
              <TextInput
                className="bg-soft-beige rounded-xl px-4 py-3 text-charcoal-gray text-base"
                placeholder="e.g., Italian Favorites"
                placeholderTextColor="#9CA3AF"
                value={newBookName}
                onChangeText={setNewBookName}
                autoFocus
              />
            </View>
            <View className="mb-4">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Description (optional)
              </Text>
              <TextInput
                className="bg-soft-beige rounded-xl px-4 py-3 text-charcoal-gray text-base"
                placeholder="A brief description..."
                placeholderTextColor="#9CA3AF"
                value={newBookDescription}
                onChangeText={setNewBookDescription}
                multiline
                numberOfLines={2}
              />
            </View>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => {
                  setShowAddForm(false);
                  setNewBookName("");
                  setNewBookDescription("");
                }}
                className="flex-1 bg-warm-sand rounded-xl py-3 items-center justify-center mr-2"
                activeOpacity={0.7}
              >
                <Text className="text-charcoal-gray font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddBook}
                className="flex-1 bg-dark-sage rounded-xl py-3 items-center justify-center ml-2"
                activeOpacity={0.7}
              >
                <Text className="text-off-white font-semibold">Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add Button */}
        {!showAddForm && (
          <TouchableOpacity
            onPress={() => setShowAddForm(true)}
            className="absolute bottom-6 right-6 bg-dark-sage rounded-full w-14 h-14 items-center justify-center shadow-lg"
            activeOpacity={0.8}
          >
            <Plus size={24} color="#FAF9F7" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}


import "@/nativewind-setup";
import { importRecipe } from "@/src/services/recipeService";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { router } from "expo-router";
import { Link, Loader2 } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddScreen() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addRecipe = useRecipeStore((state) => state.addRecipe);

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a recipe URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      Alert.alert("Error", "Please enter a valid URL");
      return;
    }

    setIsLoading(true);

    try {
      // Import recipe from URL
      const recipeData = await importRecipe(url.trim());

      // Add recipe to store
      const newRecipe = addRecipe(recipeData);

      // Show success message
      Alert.alert(
        "Success!",
        `Recipe "${recipeData.title}" has been imported successfully.`,
        [
          {
            text: "View Recipe",
            onPress: () => {
              // Navigate to recipe detail
              router.push({
                pathname: "/recipe-detail",
                params: {
                  recipeData: JSON.stringify(newRecipe),
                },
              });
              // Reset form
              setUrl("");
            },
          },
          {
            text: "OK",
            onPress: () => {
              // Reset form
              setUrl("");
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error importing recipe:", error);
      const errorMessage = error.message || "Failed to import recipe. Please try again.";
      
      // Show more detailed error message
      Alert.alert(
        "Import Failed",
        errorMessage + "\n\nNote: Make sure the Cloud Functions are deployed and the URL is accessible.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-8">
            {/* Header */}
            <View className="mb-8">
              <Text className="text-3xl font-bold text-charcoal-gray mb-2">
                Add Recipe
              </Text>
              <Text className="text-base text-charcoal-gray/60">
                Import a recipe from any blog or website by pasting the URL
                below. Our AI will extract the ingredients, instructions, and
                cover image automatically.
              </Text>
            </View>

            {/* URL Input Section */}
            <View className="mb-6">
              <View className="mb-4">
                <Text className="text-base font-semibold text-charcoal-gray mb-2">
                  Recipe URL
                </Text>
                <View className="flex-row items-center bg-soft-beige rounded-xl px-4 py-3 border border-warm-sand/50">
                  <Link size={20} color="#5A6E6C" style={{ marginRight: 12 }} />
                  <TextInput
                    className="flex-1 text-base text-charcoal-gray"
                    placeholder="https://example.com/recipe"
                    placeholderTextColor="#9CA3AF"
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleImport}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleImport}
                disabled={isLoading || !url.trim()}
                className={`rounded-xl py-4 px-6 flex-row items-center justify-center ${
                  isLoading || !url.trim()
                    ? "bg-charcoal-gray/30"
                    : "bg-dark-sage"
                }`}
                activeOpacity={0.8}
                style={{ minHeight: 52 }}
              >
                {isLoading ? (
                  <View className="flex-row items-center">
                    <Loader2 size={20} color="#FAF9F7" style={{ marginRight: 8 }} />
                    <Text className="text-off-white text-base font-semibold">
                      Importing Recipe...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-off-white text-base font-semibold">
                    Import Recipe
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Info Section */}
            <View className="mt-8 bg-soft-beige rounded-xl p-4">
              <Text className="text-sm font-semibold text-charcoal-gray mb-2">
                How it works:
              </Text>
              <Text className="text-sm text-charcoal-gray/70 mb-1">
                • Paste a recipe URL from any blog or website
              </Text>
              <Text className="text-sm text-charcoal-gray/70 mb-1">
                • AI extracts ingredients, instructions, and nutrition info
              </Text>
              <Text className="text-sm text-charcoal-gray/70 mb-1">
                • Cover image is automatically selected from the page
              </Text>
              <Text className="text-sm text-charcoal-gray/70">
                • Recipe appears in your feed immediately
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

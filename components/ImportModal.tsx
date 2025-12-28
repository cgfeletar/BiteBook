import { importRecipe } from "@/src/services/recipeService";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { useAuthStore } from "@/src/store/useAuthStore";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Link2, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ImportModal({ visible, onClose }: ImportModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const addRecipe = useRecipeStore((state) => state.addRecipe);
  const user = useAuthStore((state) => state.user);
  const authInitialized = useAuthStore((state) => state.initialized);

  const handleAutoPaste = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText) {
        setUrl(clipboardText.trim());
      } else {
        Alert.alert("Clipboard Empty", "No URL found in clipboard");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to read clipboard");
    }
  };

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      Alert.alert("Error", "Please enter a valid URL");
      return;
    }

    // Check if user is authenticated (wait for auth to initialize first)
    if (!authInitialized) {
      // Wait for auth state to initialize before checking
      return;
    }
    
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }

    setLoading(true);

    try {
      const recipeData = await importRecipe(url);

      // Check if this is a TikTok/video recipe (has "video recipe" tag)
      const isVideoRecipe = recipeData.tags?.includes("video recipe") || false;

      // Validate recipe data
      // For video recipes, be more lenient - allow saving even without full recipe data
      const hasIngredients =
        recipeData.ingredients && recipeData.ingredients.length > 0;
      const hasSteps = recipeData.steps && recipeData.steps.length > 0;

      // For video recipes, always allow import (they might not have full recipe data)
      if (!isVideoRecipe && (!hasIngredients || !hasSteps)) {
        const missingItems: string[] = [];
        if (!hasIngredients) missingItems.push("ingredients");
        if (!hasSteps) missingItems.push("instructions");

        const missingText =
          missingItems.length === 1
            ? missingItems[0]
            : `${missingItems[0]} and ${missingItems[1]}`;

        Alert.alert(
          "Incomplete Recipe",
          `This recipe appears to be missing ${missingText}. Would you like to import it anyway?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                setLoading(false);
              },
            },
            {
              text: "Import Anyway",
              onPress: () => {
                // Add recipe to the store (this will make it appear on the homepage)
                const newRecipe = addRecipe(recipeData);

                // Show success message
                Alert.alert(
                  "Recipe Imported!",
                  `"${recipeData.title}" has been added to your recipes.`,
                  [
                    {
                      text: "View Recipe",
                      onPress: () => {
                        router.push({
                          pathname: "/recipe-detail",
                          params: {
                            recipeData: JSON.stringify(newRecipe),
                          },
                        });
                        setUrl("");
                        onClose();
                      },
                    },
                    {
                      text: "OK",
                      onPress: () => {
                        setUrl("");
                        onClose();
                      },
                    },
                  ]
                );
                setLoading(false);
              },
            },
          ]
        );
        return;
      }

      // Add recipe to the store (this will make it appear on the homepage)
      const newRecipe = addRecipe(recipeData);

      // Show success message
      Alert.alert(
        "Recipe Imported!",
        `"${recipeData.title}" has been added to your recipes.`,
        [
          {
            text: "View Recipe",
            onPress: () => {
              router.push({
                pathname: "/recipe-detail",
                params: {
                  recipeData: JSON.stringify(newRecipe),
                },
              });
              setUrl("");
              onClose();
            },
          },
          {
            text: "OK",
            onPress: () => {
              setUrl("");
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Import Failed",
        error.message || "Failed to import recipe. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl("");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-off-white" edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-soft-beige">
            <Text className="text-2xl font-bold text-charcoal-gray">
              Import Recipe
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={24} color="#3E3E3E" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1 px-6 pt-6">
            <Text className="text-base text-charcoal-gray mb-4">
              Paste a recipe URL from TikTok, Instagram, or any website to
              import it automatically.
            </Text>

            {/* URL Input */}
            <View className="mb-4">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Recipe URL
              </Text>
              <View className="flex-row items-center">
                <View className="flex-1 mr-2">
                  <TextInput
                    className="bg-soft-beige rounded-xl px-4 py-4 text-charcoal-gray text-base"
                    placeholder="https://example.com/recipe"
                    placeholderTextColor="#9CA3AF"
                    value={url}
                    onChangeText={setUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  onPress={handleAutoPaste}
                  disabled={loading}
                  className="bg-warm-sand rounded-xl items-center justify-center"
                  activeOpacity={0.7}
                  style={{ width: 44, height: 44 }}
                >
                  <Link2 size={20} color="#3E3E3E" />
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-charcoal-gray/60 mt-2 ml-1">
                Tap the icon to auto-paste from clipboard
              </Text>
            </View>

            {/* Loading State */}
            {loading && (
              <View className="items-center justify-center py-8">
                <ActivityIndicator
                  size="large"
                  color="#5A6E6C"
                  className="mb-4"
                />
                <Text className="text-lg font-semibold text-charcoal-gray mb-2">
                  AI is reading the recipe...
                </Text>
                <Text className="text-sm text-charcoal-gray/70 text-center px-4">
                  This may take a few moments while we extract ingredients,
                  steps, and nutrition info.
                </Text>
              </View>
            )}

            {/* Import Button */}
            {!loading && (
              <TouchableOpacity
                onPress={handleImport}
                disabled={!url.trim()}
                className={`rounded-xl items-center justify-center mt-6 ${
                  url.trim() ? "bg-dark-sage" : "bg-soft-beige"
                }`}
                activeOpacity={0.8}
                style={{ minHeight: 44, paddingVertical: 12 }}
              >
                <Text
                  className={`text-base font-semibold ${
                    url.trim() ? "text-off-white" : "text-charcoal-gray/40"
                  }`}
                >
                  Import Recipe
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        onSuccess={() => {
          // Retry the import after successful auth
          if (url.trim()) {
            handleImport();
          }
        }}
        message="Please sign in to import recipes"
      />
    </Modal>
  );
}

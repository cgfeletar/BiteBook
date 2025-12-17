import "@/nativewind-setup";
import { storage } from "@/src/config/firebase";
import {
  importRecipe,
  importRecipeFromImage,
} from "@/src/services/recipeService";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Camera, Image as ImageIcon, Link } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"url" | "image">("url");
  const addRecipe = useRecipeStore((state) => state.addRecipe);
  const isMountedRef = useRef(true);

  // Track if component is mounted to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Request permissions for image picker
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "We need access to your photos to import recipes from images."
          );
        }
      }
    })();
  }, []);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Preprocess image: resize and auto-rotate
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [
            // Auto-rotate based on EXIF data
            { rotate: 0 }, // ImageManipulator handles auto-rotation
          ],
          {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
            // Resize if too large (max 2000px on longest side for OCR)
            resize:
              asset.width > 2000 || asset.height > 2000
                ? { width: 2000 }
                : undefined,
          }
        );

        setSelectedImage(manipulatedImage.uri);
        setImportMode("image");
      }
    } catch (error: any) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "We need access to your camera to take photos of recipes."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Preprocess image: resize and auto-rotate
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [
            { rotate: 0 }, // Auto-rotate based on EXIF
          ],
          {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
            resize:
              asset.width > 2000 || asset.height > 2000
                ? { width: 2000 }
                : undefined,
          }
        );

        setSelectedImage(manipulatedImage.uri);
        setImportMode("image");
      }
    } catch (error: any) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const handleImportFromImage = async () => {
    if (!selectedImage) {
      Alert.alert("Error", "Please select an image first");
      return;
    }

    if (!isMountedRef.current) return;
    setIsLoading(true);

    try {
      let imageUrl = "";

      // Upload image to Firebase Storage first
      try {
        console.log("Uploading image to Firebase Storage...");
        const response = await fetch(selectedImage);
        const blob = await response.blob();

        // Create a unique filename
        const timestamp = Date.now();
        const filename = `recipe-images/${timestamp}-${Math.random()
          .toString(36)
          .substring(7)}.jpg`;
        const storageRef = ref(storage, filename);

        // Upload the image with explicit content type metadata
        await uploadBytes(storageRef, blob, {
          contentType: "image/jpeg",
        });

        // Get the download URL
        imageUrl = await getDownloadURL(storageRef);
        console.log("Image uploaded, URL:", imageUrl);
      } catch (uploadError: any) {
        console.error("Failed to upload image to Storage:", uploadError);
        // Continue with recipe import even if image upload fails
        // The recipe will be imported without a cover image
      }

      // Convert image to base64 for OCR
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove data:image/jpeg;base64, prefix
          const base64Data = base64String.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Import recipe from image
      const recipeResult = await importRecipeFromImage(base64Image);

      // Extract hasHandwriting flag and remove it from recipe data
      const { hasHandwriting, ...recipeData } = recipeResult;

      // Set the uploaded image as the cover image (if upload was successful)
      if (imageUrl) {
        console.log("Setting cover image URL:", imageUrl);
        recipeData.coverImage = imageUrl;
      } else {
        console.warn("No image URL available, recipe will have no cover image");
      }

      console.log("Recipe data before save:", {
        title: recipeData.title,
        coverImage: recipeData.coverImage,
        hasIngredients: recipeData.ingredients?.length > 0,
        hasSteps: recipeData.steps?.length > 0,
      });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        addRecipe(recipeData);
        return;
      }

      // Show handwriting warning if detected
      if (hasHandwriting) {
        Alert.alert(
          "Handwriting Detected",
          "We detected handwriting in your image. We don't currently support handwritten recipes, but you can:\n\n• Edit the recipe after it's imported\n• Add any missing details to the notes section\n\nWe'll still try to extract what we can from the image.",
          [
            {
              text: "Continue",
              onPress: () => {
                // Continue with import flow
                handleRecipeImport(recipeData);
              },
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                setIsLoading(false);
              },
            },
          ]
        );
        return;
      }

      // Validate and highlight missing fields
      const missingFields = validateRecipeData(recipeData);

      if (missingFields.length > 0) {
        const missingText = missingFields.join(", ");
        Alert.alert(
          "Recipe Imported",
          `Recipe imported successfully!\n\nMissing fields: ${missingText}\n\nYou can edit these in the recipe detail page.`,
          [
            {
              text: "OK",
              onPress: () => {
                handleRecipeImport(recipeData, missingFields);
              },
            },
          ]
        );
        return;
      }

      // Success case: no handwriting detected, no missing fields
      // Add recipe and navigate
      handleRecipeImport(recipeData);
    } catch (error: any) {
      console.error("Error importing recipe from image:", error);

      if (!isMountedRef.current) {
        return;
      }

      const errorMessage =
        error.message ||
        "Failed to import recipe from image. Please try again.";

      Alert.alert("Import Failed", errorMessage, [{ text: "OK" }]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const validateRecipeData = (recipeData: any): string[] => {
    const missing: string[] = [];
    if (!recipeData.title || recipeData.title.trim() === "") {
      missing.push("title");
    }
    if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
      missing.push("ingredients");
    }
    if (!recipeData.steps || recipeData.steps.length === 0) {
      missing.push("steps");
    }
    return missing;
  };

  const handleRecipeImport = (
    recipeData: any,
    missingFields: string[] = []
  ) => {
    // Add recipe to store
    const newRecipe = addRecipe(recipeData);

    if (!isMountedRef.current) {
      return;
    }

    // Reset form
    setSelectedImage(null);
    setImportMode("url");

    // Navigate to recipe detail page
    router.push({
      pathname: "/recipe-detail",
      params: {
        recipeData: JSON.stringify(newRecipe),
        ...(missingFields.length > 0 && {
          missingFields: JSON.stringify(missingFields),
        }),
      },
    });
    setIsLoading(false);
  };

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

    if (!isMountedRef.current) return;
    setIsLoading(true);

    try {
      // Import recipe from URL
      const recipeData = await importRecipe(url.trim());

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        // Component unmounted, but recipe was imported - add it silently
        addRecipe(recipeData);
        return;
      }

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
                setIsLoading(false);
              },
            },
            {
              text: "Import Anyway",
              onPress: () => {
                // Add recipe to store
                const newRecipe = addRecipe(recipeData);

                // Reset form
                setUrl("");

                // Automatically navigate to recipe detail page
                router.push({
                  pathname: "/recipe-detail",
                  params: {
                    recipeData: JSON.stringify(newRecipe),
                  },
                });
                setIsLoading(false);
              },
            },
          ]
        );
        return;
      }

      // Add recipe to store
      const newRecipe = addRecipe(recipeData);

      // Check if component is still mounted before navigation
      if (!isMountedRef.current) {
        // Component unmounted, recipe was added but don't navigate
        return;
      }

      // Reset form
      setUrl("");

      // Automatically navigate to recipe detail page
      router.push({
        pathname: "/recipe-detail",
        params: {
          recipeData: JSON.stringify(newRecipe),
        },
      });
    } catch (error: any) {
      console.error("Error importing recipe:", error);

      // Only show error if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      const errorMessage =
        error.message || "Failed to import recipe. Please try again.";

      // Show more detailed error message
      Alert.alert(
        "Import Failed",
        errorMessage +
          "\n\nNote: Make sure the Cloud Functions are deployed and the URL is accessible.",
        [{ text: "OK" }]
      );
    } finally {
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setIsLoading(false);
      }
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
                Import a recipe from a URL, photo, or screenshot. We will
                extract the ingredients, instructions, and cover image
                automatically.
              </Text>
            </View>

            {/* Import Mode Toggle */}
            <View className="mb-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setImportMode("url");
                  setSelectedImage(null);
                }}
                className={`flex-1 rounded-xl py-3 px-4 border-2 ${
                  importMode === "url"
                    ? "bg-dark-sage border-dark-sage"
                    : "bg-soft-beige border-warm-sand"
                }`}
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-center">
                  <Link
                    size={18}
                    color={importMode === "url" ? "#FAF9F7" : "#5A6E6C"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      importMode === "url"
                        ? "text-off-white"
                        : "text-charcoal-gray"
                    }`}
                  >
                    URL
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setImportMode("image")}
                className={`flex-1 rounded-xl py-3 px-4 border-2 ${
                  importMode === "image"
                    ? "bg-dark-sage border-dark-sage"
                    : "bg-soft-beige border-warm-sand"
                }`}
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-center">
                  <ImageIcon
                    size={18}
                    color={importMode === "image" ? "#FAF9F7" : "#5A6E6C"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      importMode === "image"
                        ? "text-off-white"
                        : "text-charcoal-gray"
                    }`}
                  >
                    Photo
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* URL Input Section */}
            {importMode === "url" && (
              <View className="mb-6">
                <View className="mb-4">
                  <Text className="text-base font-semibold text-charcoal-gray mb-2">
                    Recipe URL
                  </Text>
                  <View className="flex-row items-center bg-soft-beige rounded-xl px-4 py-1 border border-warm-sand/50">
                    <Link
                      size={20}
                      color="#5A6E6C"
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      className="flex-1 text-base text-charcoal-gray mb-1"
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
                      <ActivityIndicator
                        size="small"
                        color="#FAF9F7"
                        style={{ marginRight: 8 }}
                      />
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

                {/* Loading Info Message */}
                {isLoading && (
                  <View className="mt-4 bg-warm-sand/50 rounded-xl p-4 border border-warm-sand">
                    <Text className="text-sm text-charcoal-gray text-center leading-5">
                      <Text className="font-semibold">
                        You're free to navigate away.
                      </Text>
                      {"\n"}
                      Recipe upload may take up to 1 minute per recipe. Your
                      recipe will be saved automatically.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Image Import Section */}
            {importMode === "image" && (
              <View className="mb-6">
                <View className="mb-4">
                  <Text className="text-base font-semibold text-charcoal-gray mb-2">
                    Recipe Photo or Screenshot
                  </Text>

                  {selectedImage ? (
                    <View className="relative">
                      <Image
                        source={{ uri: selectedImage }}
                        className="w-full h-64 rounded-xl"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setSelectedImage(null)}
                        className="absolute top-2 right-2 bg-charcoal-gray/80 rounded-full p-2"
                      >
                        <Text className="text-off-white font-bold">×</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={handlePickImage}
                        className="flex-1 bg-soft-beige rounded-xl py-4 px-4 border-2 border-warm-sand items-center justify-center"
                        activeOpacity={0.8}
                      >
                        <ImageIcon size={24} color="#5A6E6C" />
                        <Text className="text-charcoal-gray text-sm font-semibold mt-2">
                          Choose Photo
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleTakePhoto}
                        className="flex-1 bg-soft-beige rounded-xl py-4 px-4 border-2 border-warm-sand items-center justify-center"
                        activeOpacity={0.8}
                      >
                        <Camera size={24} color="#5A6E6C" />
                        <Text className="text-charcoal-gray text-sm font-semibold mt-2">
                          Take Photo
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleImportFromImage}
                  disabled={isLoading || !selectedImage}
                  className={`rounded-xl py-4 px-6 flex-row items-center justify-center ${
                    isLoading || !selectedImage
                      ? "bg-charcoal-gray/30"
                      : "bg-dark-sage"
                  }`}
                  activeOpacity={0.8}
                  style={{ minHeight: 52 }}
                >
                  {isLoading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator
                        size="small"
                        color="#FAF9F7"
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-off-white text-base font-semibold">
                        Processing Image...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-off-white text-base font-semibold">
                      Extract Recipe
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Loading Info Message */}
                {isLoading && (
                  <View className="mt-4 bg-warm-sand/50 rounded-xl p-4 border border-warm-sand">
                    <Text className="text-sm text-charcoal-gray text-center leading-5">
                      <Text className="font-semibold">
                        Processing your image...
                      </Text>
                      {"\n"}
                      Running OCR and extracting recipe data. This may take up
                      to 30 seconds.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Info Section */}
            <View className="mt-8 bg-soft-beige rounded-xl p-4">
              <Text className="text-sm font-semibold text-charcoal-gray mb-2">
                How it works:
              </Text>
              {importMode === "url" ? (
                <>
                  <Text className="text-sm text-charcoal-gray/70 mb-1">
                    • Paste a recipe URL from any blog, website, or TikTok
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
                </>
              ) : (
                <>
                  <Text className="text-sm text-charcoal-gray/70 mb-1">
                    • Take a photo or select a screenshot of a recipe
                  </Text>
                  <Text className="text-sm text-charcoal-gray/70 mb-1">
                    • OCR extracts text from the image (typed text only)
                  </Text>
                  <Text className="text-sm text-charcoal-gray/70 mb-1">
                    • AI parses the text into structured recipe data
                  </Text>
                  <Text className="text-sm text-charcoal-gray/70">
                    • Review and edit any missing fields
                  </Text>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

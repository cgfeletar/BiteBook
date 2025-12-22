import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../config/firebase";
import { Ingredient, NutritionalInfo, RecipeCreateInput } from "../types";
import { autoTagRecipe } from "../utils/autoTagRecipe";

// Initialize Cloud Functions with us-central1 region
const functions = getFunctions(app, "us-central1");

/**
 * Import recipe from URL using AI extraction
 * @param url - The URL of the recipe to import
 * @returns Extracted recipe data (without id and createdAt)
 */
export async function importRecipe(url: string): Promise<RecipeCreateInput> {
  try {
    // Validate URL format
    if (!url || typeof url !== "string") {
      throw new Error("Invalid URL provided");
    }

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (
      !formattedUrl.startsWith("http://") &&
      !formattedUrl.startsWith("https://")
    ) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Call the Cloud Function
    const extractRecipeFromUrl = httpsCallable<
      { url: string },
      RecipeCreateInput
    >(functions, "extractRecipeFromUrl");

    const result = await extractRecipeFromUrl({ url: formattedUrl });

    // Auto-generate tags based on recipe content
    const recipeData = result.data;
    const autoTags = autoTagRecipe(recipeData);
    
    // Merge auto-generated tags with existing tags (if any)
    return {
      ...recipeData,
      tags: autoTags,
    };
  } catch (error: any) {
    // Handle Firebase function errors
    // Firebase Functions errors can have different structures
    const errorCode = error?.code || error?.details?.code || "";
    const errorMessage = error?.message || error?.details?.message || "";

    if (
      errorCode === "functions/unauthenticated" ||
      errorCode === "unauthenticated" ||
      errorMessage.includes("authenticated")
    ) {
      throw new Error("You must be logged in to import recipes");
    } else if (
      errorCode === "functions/invalid-argument" ||
      errorCode === "invalid-argument"
    ) {
      throw new Error("Invalid URL provided");
    } else if (
      errorCode === "functions/not-found" ||
      errorCode === "not-found"
    ) {
      throw new Error("Could not fetch the recipe from the provided URL");
    } else if (
      errorCode === "functions/deadline-exceeded" ||
      errorCode === "deadline-exceeded"
    ) {
      throw new Error("The request took too long. Please try again.");
    } else if (errorMessage) {
      throw new Error(errorMessage);
    } else {
      throw new Error("Failed to import recipe. Please try again.");
    }
  }
}

/**
 * Import recipe from image using OCR and AI extraction
 * @param imageBase64 - Base64 encoded image data (without data URI prefix)
 * @returns Extracted recipe data (without id and createdAt) and handwriting detection flag
 */
export async function importRecipeFromImage(
  imageBase64: string
): Promise<RecipeCreateInput & { hasHandwriting?: boolean }> {
  try {
    // Validate image data
    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new Error("Invalid image data provided");
    }

    // Call the Cloud Function
    const extractRecipeFromImage = httpsCallable<
      { imageBase64: string },
      RecipeCreateInput & { hasHandwriting?: boolean }
    >(functions, "extractRecipeFromImage");

    const result = await extractRecipeFromImage({ imageBase64 });

    // Auto-generate tags based on recipe content
    const recipeData = result.data;
    const { hasHandwriting, ...recipeWithoutHandwriting } = recipeData;
    const autoTags = autoTagRecipe(recipeWithoutHandwriting);
    
    // Merge auto-generated tags with existing tags (if any)
    return {
      ...recipeWithoutHandwriting,
      tags: autoTags,
      hasHandwriting: hasHandwriting || false,
    };
  } catch (error: any) {
    // Handle Firebase function errors
    const errorCode = error?.code || error?.details?.code || "";
    const errorMessage = error?.message || error?.details?.message || "";

    if (
      errorCode === "functions/unauthenticated" ||
      errorCode === "unauthenticated" ||
      errorMessage.includes("authenticated")
    ) {
      throw new Error("You must be logged in to import recipes");
    } else if (
      errorCode === "functions/invalid-argument" ||
      errorCode === "invalid-argument"
    ) {
      throw new Error("Invalid image data provided");
    } else if (errorMessage) {
      throw new Error(errorMessage);
    } else {
      throw new Error("Failed to import recipe from image. Please try again.");
    }
  }
}

/**
 * Generate nutritional information from ingredients using AI
 * @param ingredients - Array of ingredients
 * @returns Generated nutritional information
 */
export async function generateNutritionalInfo(
  ingredients: Ingredient[]
): Promise<NutritionalInfo> {
  try {
    if (!ingredients || ingredients.length === 0) {
      throw new Error("Ingredients are required");
    }

    const generateNutrition = httpsCallable<
      { ingredients: Ingredient[] },
      NutritionalInfo
    >(functions, "generateNutritionalInfo");

    const result = await generateNutrition({ ingredients });
    return result.data;
  } catch (error: any) {
    // Handle Firebase function errors
    const errorCode = error?.code || error?.details?.code || "";
    const errorMessage = error?.message || error?.details?.message || "";

    if (
      errorCode === "functions/unauthenticated" ||
      errorCode === "unauthenticated" ||
      errorMessage.includes("authenticated")
    ) {
      throw new Error("You must be logged in to generate nutritional info");
    } else if (errorMessage) {
      throw new Error(errorMessage);
    }
    throw new Error(
      "Failed to generate nutritional information. Please try again."
    );
  }
}

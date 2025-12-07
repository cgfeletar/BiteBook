import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';
import { RecipeCreateInput, Ingredient, NutritionalInfo } from '../types';

// Initialize Cloud Functions
const functions = getFunctions(app);

/**
 * Import recipe from URL using AI extraction
 * @param url - The URL of the recipe to import
 * @returns Extracted recipe data (without id and createdAt)
 */
export async function importRecipe(url: string): Promise<RecipeCreateInput> {
  try {
    // Validate URL format
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Call the Cloud Function
    const extractRecipeFromUrl = httpsCallable<{ url: string }, RecipeCreateInput>(
      functions,
      'extractRecipeFromUrl'
    );

    const result = await extractRecipeFromUrl({ url: formattedUrl });
    
    return result.data;
  } catch (error: any) {
    // Handle Firebase function errors
    if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to import recipes');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Invalid URL provided');
    } else if (error.code === 'functions/not-found') {
      throw new Error('Could not fetch the recipe from the provided URL');
    } else if (error.code === 'functions/deadline-exceeded') {
      throw new Error('The request took too long. Please try again.');
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to import recipe. Please try again.');
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
      throw new Error('Ingredients are required');
    }

    const generateNutrition = httpsCallable<
      { ingredients: Ingredient[] },
      NutritionalInfo
    >(functions, 'generateNutritionalInfo');

    const result = await generateNutrition({ ingredients });
    return result.data;
  } catch (error: any) {
    if (error.message) {
      throw new Error(error.message);
    }
    throw new Error('Failed to generate nutritional information. Please try again.');
  }
}


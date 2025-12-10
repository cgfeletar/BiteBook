import axios from "axios";
import * as cheerio from "cheerio";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

// Initialize Firebase Admin
admin.initializeApp();

// Define the secret for OpenAI API Key
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

/**
 * TypeScript interfaces matching the client-side Recipe interface
 */
interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  isChecked: boolean;
}

interface Step {
  id: string;
  instruction: string;
  isCompleted: boolean;
  isBeginnerFriendly: boolean;
  timerDuration?: number;
}

interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  [key: string]: number | undefined;
}

interface Recipe {
  id: string;
  title: string;
  coverImage: string;
  ingredients: Ingredient[];
  steps: Step[];
  nutritionalInfo: NutritionalInfo;
  sourceUrl: string;
  originalAuthor: string;
  tags: string[];
  categoryIds: string[];
  createdAt: admin.firestore.Timestamp | Date;
}

/**
 * LLM Prompt for extracting structured recipe data from messy HTML
 *
 * This prompt is designed to be used with OpenAI GPT models.
 * It handles messy, unstructured recipe data from various websites.
 */
const RECIPE_EXTRACTION_PROMPT = `You are an expert recipe data extraction assistant. Your task is to extract structured recipe information from raw HTML content and output it as a JSON object.

IMPORTANT: You must output ONLY valid JSON that matches this exact TypeScript interface:

{
  "title": string,
  "coverImage": string (URL or path),
  "ingredients": Array<{
    "name": string,
    "quantity": number,
    "unit": string,
    "isChecked": boolean (always false)
  }>,
  "steps": Array<{
    "id": string (unique, e.g., "step-1", "step-2"),
    "instruction": string,
    "isCompleted": boolean (always false),
    "isBeginnerFriendly": boolean,
    "timerDuration": number | null (in seconds, optional)
  }>,
  "nutritionalInfo": {
    "calories": number | null,
    "protein": number | null (in grams),
    "carbohydrates": number | null (in grams),
    "fat": number | null (in grams),
    "fiber": number | null (in grams),
    "sugar": number | null (in grams),
    "sodium": number | null (in milligrams)
  },
  "sourceUrl": string,
  "originalAuthor": string,
  "tags": string[],
  "categoryIds": string[] (empty array if unknown)
}

EXTRACTION RULES:

1. TITLE:
   - Extract the main recipe title from <h1>, <h2>, or meta tags (og:title, twitter:title)
   - Clean up extra whitespace, emojis, and "Recipe:" prefixes
   - If multiple titles exist, choose the most prominent one

2. COVER IMAGE:
   - Look for images in this priority: og:image, twitter:image, first large <img> in content
   - Prefer images with "recipe", "food", or "dish" in alt text
   - Extract full URL (resolve relative URLs to absolute)
   - If no image found, use empty string ""

3. INGREDIENTS:
   - Parse ingredient lists from various formats:
     * "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
     * "1/2 tsp salt" → { name: "salt", quantity: 0.5, unit: "tsp" }
     * "1 egg" → { name: "egg", quantity: 1, unit: "egg" } (NOT cups!)
     * "3 large eggs" → { name: "eggs", quantity: 3, unit: "large" }
   - CRITICAL: Whole items like eggs, pieces, items should NEVER be converted to volume units (cups, tsp, etc.)
   - For whole items: use unit "egg", "eggs", "piece", "pieces", "whole", "item", or descriptive size like "large", "medium", "small"
   - Handle fractions: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, etc. (for volume/weight units only)
   - Handle ranges: "2-3 cups" → use average (2.5) or first number (2)
   - Handle "to taste", "as needed" → quantity: 1, unit: "to taste"
   - Extract from common selectors: [data-ingredient], .ingredient, .recipe-ingredient, <li> in ingredient lists
   - Clean ingredient names: remove quantities, units, and extra text
   - Always set isChecked to false

4. STEPS:
   - Extract cooking instructions from ordered/unordered lists, paragraphs, or structured data
   - Look for: <ol>, <ul> with class containing "step", "instruction", "direction"
   - Each step should be a complete, actionable instruction
   - Generate unique IDs: "step-1", "step-2", etc.
   - Determine isBeginnerFriendly:
     * true: Simple actions like "mix", "stir", "bake at 350°F"
     * false: Complex techniques like "temper", "braise", "sous vide"
   - Extract timerDuration from text:
     * "bake for 20 minutes" → 1200 seconds
     * "simmer 5 min" → 300 seconds
     * "cook until golden" → null
   - Always set isCompleted to false

5. NUTRITIONAL INFO:
   - Extract from nutrition facts tables, JSON-LD, or text
   - Look for patterns: "Calories: 250", "Protein 10g", etc.
   - Convert units: ensure protein/carbs/fat in grams, sodium in mg
   - If not found, set to null (not 0)

6. SOURCE URL:
   - Use the provided URL (already known)

7. ORIGINAL AUTHOR:
   - Extract from: author meta tags, "By [Name]", recipe card author fields
   - If not found, use "Unknown" or website name

8. TAGS:
   - Generate relevant tags from:
     * Recipe type: "dessert", "main-course", "appetizer", "breakfast"
     * Cuisine: "italian", "mexican", "asian", etc.
     * Dietary: "vegetarian", "vegan", "gluten-free", "keto"
     * Cooking method: "baked", "grilled", "slow-cooked"
   - Extract from meta keywords, categories, or infer from content
   - Minimum 2-3 tags, maximum 8 tags

9. CATEGORY IDS:
   - Leave as empty array [] if categories are not clearly defined
   - Only include if explicit category system exists

HANDLING MESSY DATA:
- Remove HTML tags, extra whitespace, and formatting
- Ignore ads, navigation, comments, and unrelated content
- If data is ambiguous, make reasonable inferences
- If critical data is missing, use sensible defaults (empty arrays, null values)
- Preserve original meaning even if formatting is inconsistent

OUTPUT FORMAT:
Return ONLY the JSON object, no markdown, no code blocks, no explanations. The JSON must be valid and parseable.

Raw HTML content:
`;

/**
 * Call OpenAI API to extract recipe data from HTML content
 */
async function callLLM(
  htmlContent: string,
  sourceUrl: string
): Promise<Omit<Recipe, "id" | "createdAt">> {
  // Access API key from secret
  const apiKeyRaw = OPENAI_API_KEY.value();
  
  if (!apiKeyRaw) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please set it using:\n" +
        "firebase functions:secrets:set OPENAI_API_KEY"
    );
  }

  // Clean the API key - remove any whitespace, newlines, or special characters
  const apiKey = apiKeyRaw.trim().replace(/\s+/g, "");

  // Truncate HTML content if too long (OpenAI has token limits)
  // Keep first 100k characters to ensure we stay within limits
  const maxLength = 100000;
  const truncatedContent =
    htmlContent.length > maxLength
      ? htmlContent.substring(0, maxLength) + "\n\n[Content truncated...]"
      : htmlContent;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o", // Using GPT-4o for best results, can fallback to gpt-3.5-turbo if needed
        messages: [
          {
            role: "system",
            content:
              "You are an expert recipe extraction assistant. Extract structured recipe data from HTML content and return ONLY valid JSON matching the required schema.",
          },
          {
            role: "user",
            content: RECIPE_EXTRACTION_PROMPT + "\n\n" + truncatedContent,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60 second timeout
      }
    );

    // Check if response has choices
    if (!response.data.choices || response.data.choices.length === 0) {
      throw new Error("No choices in OpenAI response");
    }

    const choice = response.data.choices[0];
    if (choice.finish_reason !== "stop") {
      console.warn(
        `OpenAI finish reason: ${choice.finish_reason}. This may indicate truncated response.`
      );
    }

    const responseText = choice.message?.content;
    if (!responseText) {
      throw new Error("OpenAI returned no content");
    }

    let extractedData: any;

    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse OpenAI response as JSON: ${
          parseError.message
        }. Response: ${responseText.substring(0, 200)}`
      );
    }

    // Validate required fields
    if (!extractedData.title) {
      throw new Error("Extracted data missing required field: title");
    }

    // Ensure sourceUrl is set
    extractedData.sourceUrl = sourceUrl;

    return extractedData;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(`OpenAI API error (${status}): ${JSON.stringify(data)}`);
    }
    throw error;
  }
}

/**
 * Extract recipe from URL using web scraping and LLM
 */
export const extractRecipeFromUrl = functions
  .region("europe-central2")
  .runWith({ secrets: [OPENAI_API_KEY] })
  .https.onCall(async (data: { url: string }, context) => {
    // Note: Authentication is optional - users can import recipes without logging in

    // Validate input
    if (!data.url || typeof data.url !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "URL is required and must be a string"
      );
    }

    try {
      // Fetch HTML content
      const response = await axios.get(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      // Parse HTML with Cheerio
      const $ = cheerio.load(response.data);

      // Remove script and style tags
      $("script, style, noscript").remove();

      // Extract main content (prioritize article, main, or body)
      let htmlContent = "";
      const article = $("article").first();
      const main = $("main").first();
      const body = $("body");

      if (article.length > 0) {
        htmlContent = article.html() || "";
      } else if (main.length > 0) {
        htmlContent = main.html() || "";
      } else {
        // Remove common non-recipe elements
        $(
          "header, nav, footer, aside, .ad, .advertisement, .social-share"
        ).remove();
        htmlContent = body.html() || "";
      }

      // Clean up HTML: remove excessive whitespace but preserve structure
      htmlContent = htmlContent
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();

      // Call LLM to extract structured data
      const extractedData = await callLLM(htmlContent, data.url);

      // Validate and structure the response
      const recipe: Omit<Recipe, "id" | "createdAt"> = {
        title: extractedData.title || "Untitled Recipe",
        coverImage: extractedData.coverImage || "",
        ingredients: extractedData.ingredients || [],
        steps: extractedData.steps || [],
        nutritionalInfo: extractedData.nutritionalInfo || {},
        sourceUrl: data.url,
        originalAuthor: extractedData.originalAuthor || "Unknown",
        tags: extractedData.tags || [],
        categoryIds: extractedData.categoryIds || [],
      };

      return recipe;
    } catch (error: any) {
      console.error("Error extracting recipe:", error);

      if (error.response) {
        throw new functions.https.HttpsError(
          "not-found",
          `Failed to fetch URL: ${error.response.status} ${error.response.statusText}`
        );
      } else if (error.code === "ECONNABORTED") {
        throw new functions.https.HttpsError(
          "deadline-exceeded",
          "Request timeout. The URL took too long to respond."
        );
      } else {
        throw new functions.https.HttpsError(
          "internal",
          `Failed to extract recipe: ${error.message}`
        );
      }
    }
  });

/**
 * Generate nutritional information from ingredients using AI
 */
const NUTRITION_GENERATION_PROMPT = `You are a nutrition calculation assistant. Calculate the nutritional information for a recipe based on its ingredients.

Given a list of ingredients with quantities and units, calculate the total nutritional values for the ENTIRE RECIPE (not per serving).

Output ONLY valid JSON matching this exact structure:
{
  "calories": number,
  "protein": number (in grams),
  "carbohydrates": number (in grams),
  "fat": number (in grams),
  "fiber": number (in grams, optional),
  "sugar": number (in grams, optional),
  "sodium": number (in milligrams, optional)
}

Rules:
- Calculate totals for the entire recipe based on all ingredients
- Use standard nutritional databases for common ingredients
- Convert all units to grams/milligrams as needed
- Round to nearest whole number
- If an ingredient is ambiguous, make reasonable estimates
- Include all ingredients in the calculation
- Return null for optional fields if you cannot determine them

Ingredients list:
`;

async function generateNutritionFromIngredients(
  ingredients: Ingredient[]
): Promise<NutritionalInfo> {
  const ingredientsList = ingredients
    .map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`)
    .join("\n");

  const prompt = NUTRITION_GENERATION_PROMPT + ingredientsList;

  // Access API key from secret
  const apiKeyRaw = OPENAI_API_KEY.value();
  
  if (!apiKeyRaw) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please set it using:\n" +
        "firebase functions:secrets:set OPENAI_API_KEY"
    );
  }

  // Clean the API key - remove any whitespace, newlines, or special characters
  const apiKey = apiKeyRaw.trim().replace(/\s+/g, "");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o", // Using GPT-4o for best results
        messages: [
          {
            role: "system",
            content:
              "You are a nutrition calculation assistant. Calculate nutritional information from ingredients and return ONLY valid JSON matching the required schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60 second timeout
      }
    );

    // Check if response has choices
    if (!response.data.choices || response.data.choices.length === 0) {
      throw new Error("No choices in OpenAI response");
    }

    const choice = response.data.choices[0];
    if (choice.finish_reason !== "stop") {
      console.warn(
        `OpenAI finish reason: ${choice.finish_reason}. This may indicate truncated response.`
      );
    }

    const responseText = choice.message?.content;
    if (!responseText) {
      throw new Error("OpenAI returned no content");
    }

    let nutritionData: any;

    try {
      nutritionData = JSON.parse(responseText);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse OpenAI response as JSON: ${
          parseError.message
        }. Response: ${responseText.substring(0, 200)}`
      );
    }

    return nutritionData;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(`OpenAI API error (${status}): ${JSON.stringify(data)}`);
    }
    throw error;
  }
}

/**
 * Generate nutritional info from ingredients
 */
export const generateNutritionalInfo = functions
  .region("europe-central2")
  .runWith({ secrets: [OPENAI_API_KEY] })
  .https.onCall(async (data: { ingredients: Ingredient[] }, context) => {
    // Note: Authentication is optional - users can generate nutritional info without logging in

    // Validate input
    if (
      !data.ingredients ||
      !Array.isArray(data.ingredients) ||
      data.ingredients.length === 0
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Ingredients array is required and must not be empty"
      );
    }

    try {
      const nutritionalInfo = await generateNutritionFromIngredients(
        data.ingredients
      );
      return nutritionalInfo;
    } catch (error: any) {
      console.error("Error generating nutritional info:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate nutritional info: ${error.message}`
      );
    }
  });

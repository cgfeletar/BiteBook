import axios from "axios";
import * as cheerio from "cheerio";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin
admin.initializeApp();

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
 * This prompt is designed to be used with Google Gemini.
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
     * "3 large eggs" → { name: "eggs", quantity: 3, unit: "large" }
   - Handle fractions: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, etc.
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
 * Call Gemini API to extract recipe data from HTML content
 */
async function callLLM(
  htmlContent: string,
  sourceUrl: string
): Promise<Omit<Recipe, "id" | "createdAt">> {
  // Check for API key - try multiple sources
  const apiKey =
    process.env.GEMINI_API_KEY || functions.config().gemini?.api_key || null;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please set it using:\n" +
        "1. Environment variable: GEMINI_API_KEY\n" +
        '2. Firebase config: firebase functions:config:set gemini.api_key="YOUR_KEY"\n' +
        "3. Firebase secrets: firebase functions:secrets:set GEMINI_API_KEY"
    );
  }

  // Truncate HTML content if too long (Gemini has token limits)
  // Keep first 100k characters to ensure we stay within limits
  const maxLength = 100000;
  const truncatedContent =
    htmlContent.length > maxLength
      ? htmlContent.substring(0, maxLength) + "\n\n[Content truncated...]"
      : htmlContent;

  try {
    // Use Gemini 1.5 Pro or Flash - try Pro first, fallback to Flash
    const models = ["gemini-1.5-pro", "gemini-1.5-flash"];
    let lastError: any = null;

    for (const model of models) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            contents: [
              {
                parts: [
                  {
                    text: RECIPE_EXTRACTION_PROMPT + "\n\n" + truncatedContent,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  coverImage: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        isChecked: { type: "boolean" },
                      },
                      required: ["name", "quantity", "unit", "isChecked"],
                    },
                  },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        instruction: { type: "string" },
                        isCompleted: { type: "boolean" },
                        isBeginnerFriendly: { type: "boolean" },
                        timerDuration: {
                          type: ["number", "null"],
                        },
                      },
                      required: [
                        "id",
                        "instruction",
                        "isCompleted",
                        "isBeginnerFriendly",
                      ],
                    },
                  },
                  nutritionalInfo: {
                    type: "object",
                    properties: {
                      calories: { type: ["number", "null"] },
                      protein: { type: ["number", "null"] },
                      carbohydrates: { type: ["number", "null"] },
                      fat: { type: ["number", "null"] },
                      fiber: { type: ["number", "null"] },
                      sugar: { type: ["number", "null"] },
                      sodium: { type: ["number", "null"] },
                    },
                  },
                  sourceUrl: { type: "string" },
                  originalAuthor: { type: "string" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                  },
                  categoryIds: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "title",
                  "coverImage",
                  "ingredients",
                  "steps",
                  "nutritionalInfo",
                  "sourceUrl",
                  "originalAuthor",
                  "tags",
                  "categoryIds",
                ],
              },
              temperature: 0.3,
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 60000, // 60 second timeout
          }
        );

        // Check if response has candidates
        if (
          !response.data.candidates ||
          response.data.candidates.length === 0
        ) {
          throw new Error("No candidates in Gemini response");
        }

        const candidate = response.data.candidates[0];
        if (candidate.finishReason !== "STOP") {
          console.warn(
            `Gemini finish reason: ${candidate.finishReason}. Model: ${model}`
          );
        }

        const responseText = candidate.content.parts[0].text;
        let extractedData: any;

        try {
          extractedData =
            typeof responseText === "string"
              ? JSON.parse(responseText)
              : responseText;
        } catch (parseError: any) {
          throw new Error(
            `Failed to parse Gemini response as JSON: ${
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
        lastError = error;
        console.warn(`Failed to use model ${model}:`, error.message);
        // Try next model
        continue;
      }
    }

    // If all models failed, throw the last error
    throw new Error(
      `All Gemini models failed. Last error: ${
        lastError?.message || "Unknown error"
      }`
    );
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(`Gemini API error (${status}): ${JSON.stringify(data)}`);
    }
    throw error;
  }
}

/**
 * Extract recipe from URL using web scraping and LLM
 */
export const extractRecipeFromUrl = functions
  .region("europe-central2")
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

  // Use Gemini for nutrition generation
  const apiKey =
    process.env.GEMINI_API_KEY || functions.config().gemini?.api_key || null;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please set it using:\n" +
        "1. Environment variable: GEMINI_API_KEY\n" +
        '2. Firebase config: firebase functions:config:set gemini.api_key="YOUR_KEY"\n' +
        "3. Firebase secrets: firebase functions:secrets:set GEMINI_API_KEY"
    );
  }

  // Try Gemini models (Pro first, then Flash)
  const models = ["gemini-1.5-pro", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                calories: { type: "number" },
                protein: { type: "number" },
                carbohydrates: { type: "number" },
                fat: { type: "number" },
                fiber: { type: "number" },
                sugar: { type: "number" },
                sodium: { type: "number" },
              },
              required: ["calories", "protein", "carbohydrates", "fat"],
            },
            temperature: 0.3,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 60000, // 60 second timeout
        }
      );

      // Check if response has candidates
      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error("No candidates in Gemini response");
      }

      const candidate = response.data.candidates[0];
      if (candidate.finishReason !== "STOP") {
        console.warn(
          `Gemini finish reason: ${candidate.finishReason}. Model: ${model}`
        );
      }

      const responseText = candidate.content.parts[0].text;
      let nutritionData: any;

      try {
        nutritionData =
          typeof responseText === "string"
            ? JSON.parse(responseText)
            : responseText;
      } catch (parseError: any) {
        throw new Error(
          `Failed to parse Gemini response as JSON: ${
            parseError.message
          }. Response: ${responseText.substring(0, 200)}`
        );
      }

      return nutritionData;
    } catch (error: any) {
      lastError = error;
      console.warn(`Failed to use model ${model}:`, error.message);
      // Try next model
      continue;
    }
  }

  // If all models failed, throw the last error
  throw new Error(
    `All Gemini models failed. Last error: ${
      lastError?.message || "Unknown error"
    }`
  );
}

/**
 * Generate nutritional info from ingredients
 */
export const generateNutritionalInfo = functions
  .region("europe-central2")
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

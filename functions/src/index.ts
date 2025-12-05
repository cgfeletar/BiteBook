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
 * This prompt is designed to be used with OpenAI GPT-4, GPT-3.5, or Google Gemini.
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
 * Call LLM API (OpenAI or Gemini) to extract recipe data
 * Replace this with your actual LLM API call
 */
async function callLLM(
  htmlContent: string,
  sourceUrl: string
): Promise<Omit<Recipe, "id" | "createdAt">> {
  // TODO: Replace with your actual LLM API call
  // Example for OpenAI:
  /*
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: RECIPE_EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: htmlContent
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const responseText = response.data.choices[0].message.content;
  let extractedData;
  try {
    extractedData = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
  } catch (parseError) {
    throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
  }
  */

  // Example for Google Gemini (with Schema for structured output):
  /*
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [{
          text: RECIPE_EXTRACTION_PROMPT + '\n\n' + htmlContent
        }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            coverImage: { type: 'string' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string' },
                  isChecked: { type: 'boolean' }
                },
                required: ['name', 'quantity', 'unit', 'isChecked']
              }
            },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  instruction: { type: 'string' },
                  isCompleted: { type: 'boolean' },
                  isBeginnerFriendly: { type: 'boolean' },
                  timerDuration: { type: ['number', 'null'] }
                },
                required: ['id', 'instruction', 'isCompleted', 'isBeginnerFriendly']
              }
            },
            nutritionalInfo: {
              type: 'object',
              properties: {
                calories: { type: ['number', 'null'] },
                protein: { type: ['number', 'null'] },
                carbohydrates: { type: ['number', 'null'] },
                fat: { type: ['number', 'null'] },
                fiber: { type: ['number', 'null'] },
                sugar: { type: ['number', 'null'] },
                sodium: { type: ['number', 'null'] }
              }
            },
            sourceUrl: { type: 'string' },
            originalAuthor: { type: 'string' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            categoryIds: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['title', 'coverImage', 'ingredients', 'steps', 'nutritionalInfo', 'sourceUrl', 'originalAuthor', 'tags', 'categoryIds']
        }
      }
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  const responseText = response.data.candidates[0].content.parts[0].text;
  let extractedData;
  try {
    extractedData = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
  } catch (parseError) {
    throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
  }
  */

  // Placeholder: You must implement the actual LLM call
  throw new Error(
    "LLM API call not implemented. Please add your OpenAI or Gemini API integration."
  );
}

/**
 * Extract recipe from URL using web scraping and LLM
 */
export const extractRecipeFromUrl = functions.https.onCall(
  async (data: { url: string }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to extract recipes"
      );
    }

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
  }
);

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
  title?: string; // Optional title for instruction sections (e.g., "Make the dough")
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
  prepTime?: number; // Prep time in minutes (active prep time)
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
    "timerDuration": number | null (in seconds, optional),
    "title": string | null (optional title for instruction sections, e.g., "Make the dough")
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
  "categoryIds": string[] (empty array if unknown),
  "prepTime": number | null (in minutes, optional - active prep time only)
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
   - CRITICAL: Locate the ingredient list section in the HTML. Look for headings like "Ingredients", "Ingredients You'll Need", "For the [X]", or similar. The ingredient list is usually in a <ul>, <ol>, or <div> with classes like "ingredients", "recipe-ingredients", "ingredient-list", etc.
   - CRITICAL: Extract the ACTUAL quantity and unit from each ingredient line. Do NOT default to "1 to taste" unless the recipe explicitly says "to taste" or "as needed".
   - Parse ingredient lists from various formats (do not round):
     * "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
     * "1/2 tsp salt" → { name: "salt", quantity: 0.5, unit: "tsp" }
     * "1/4 cup butter" → { name: "butter", quantity: 0.25, unit: "cup" }
     * "1 egg" → { name: "egg", quantity: 1, unit: "egg" } (NOT cups!)
     * "3 large eggs" → { name: "eggs", quantity: 3, unit: "large" }
     * "salt, to taste" → { name: "salt", quantity: 1, unit: "to taste" } (ONLY when explicitly stated)
     * "pepper (optional)" → { name: "pepper", quantity: 1, unit: "to taste" } (if no quantity given and optional)
   - CRITICAL: Whole items like eggs, pieces, items should NEVER be converted to volume units (cups, tsp, etc.)
   - For whole items: use unit "egg", "eggs", "piece", "pieces", "whole", "item", or descriptive size like "large", "medium", "small"
   - Handle fractions: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, etc. (for volume/weight units only)
   - Handle ranges: "2-3 cups" → use average (2.5) or first number (2)
   - Handle "to taste", "as needed", "optional" → quantity: 1, unit: "to taste" (ONLY when no quantity is specified and recipe says "to taste" or similar)
   - If a quantity is clearly stated in the recipe, extract it exactly - do NOT default to "to taste"
   - Look carefully for quantities even if they're written in different formats (e.g., "two cups", "2 c.", "2c", etc.)
   - Extract from common selectors: [data-ingredient], .ingredient, .recipe-ingredient, <li> in ingredient lists, or any list items under an "Ingredients" heading
   - Each ingredient should be on its own line or list item
   - Clean ingredient names: remove quantities, units, and extra text (parenthetical notes can stay if they're part of the ingredient name)
   - Always set isChecked to false
   - IMPORTANT: If you see an ingredient list with clear quantities (like "2 cups flour", "1/2 tsp salt"), extract those exact quantities. Do not assume "to taste" unless the recipe explicitly says so.

4. STEPS:
   - CRITICAL: Find the section that contains intructions (this is usually just below the ingredient list), then extract ALL cooking instructions - do not skip or omit any steps
   - Extract from ordered/unordered lists, paragraphs, or structured data
   - Look for: <ol>, <ul> with class containing "step", "instruction", "direction"
   - Also check: numbered lists, bullet points, recipe instruction sections, and any text that describes cooking actions
   - If instructions are in paragraph form, split them into individual steps
   - If there is a title above one section of instructions (for example "Make the dough"), then extract that title as the step title.
   - Each step should be a complete, actionable instruction
   - Generate unique IDs: "step-1", "step-2", etc. for ALL steps found
   - CRITICAL FORMATTING RULE: When an instruction mentions multiple ingredients (2 or more), format them as a bulleted list within the same instruction text:
     * Example: "Combine butter, flour, and sugar" → "Combine:\n• butter\n• flour\n• sugar"
     * Example: "Add eggs, vanilla, and salt" → "Add:\n• eggs\n• vanilla\n• salt"
     * The instruction text should start with the action verb, followed by a colon, then list each ingredient on a new line with a bullet point (•)
     * This makes the instructions clearer while keeping all content in the same instruction card
     * Only apply this formatting when there are 2 or more ingredients mentioned together in a single instruction
   - TIME INFORMATION IN INSTRUCTIONS:
     * Keep time information in the instruction text when it's part of the actual cooking instruction
     * Examples: "Bake for 20 minutes", "Simmer for 10 minutes", "Cook in slow cooker for 2 hours", "Saute for 5 minutes"
     * Only include time when it's explicitly part of the cooking instruction itself
   - Determine isBeginnerFriendly:
     * true: Simple actions like "mix", "stir", "bake at 350°F"
     * false: Complex techniques like "temper", "braise", "sous vide"
   - Also return timerDuration from text (for timer feature):
     * "bake for 20 minutes" → 1200 seconds (AND keep "bake for 20 minutes" in instruction text)
     * "simmer 5 min" → 300 seconds (AND keep "simmer 5 min" in instruction text)
     * "cook until golden" → null (no specific time mentioned)
     * Also return timerDuration when there's a specific time duration mentioned in the instruction
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

10. PREP TIME (REQUIRED - always estimate if not explicitly stated):
   - Extract prep time (active preparation time) in minutes
   - FIRST: Look for explicit prep time fields: "Prep Time:", "Preparation Time:", "Prep:", "Active Time:", etc.
   - If explicitly stated, use that value (convert to minutes if needed)
   - If NOT explicitly stated, you MUST estimate based on instructions:
     * Analyze all steps and count only active prep work (chopping, mixing, measuring, slicing, dicing, etc.)
     * Exclude passive steps (waiting, resting, marinating, baking, cooking, simmering, roasting)
     * Exclude steps that are just "bake for X minutes" or "cook until done" - these are passive
     * Estimate time per active prep step:
       - Simple tasks (mix, stir, combine, whisk): 2-3 min each
       - Medium tasks (chop vegetables, measure ingredients, dice, slice): 3-5 min each
       - Complex tasks (make dough, prepare sauce, knead, roll out): 5-10 min each
     * Sum up all active prep step estimates
   - CRITICAL: Always provide a prep time estimate - never return null unless the recipe has zero active prep steps
   - Only count time where the cook is actively working, NOT passive cooking/baking time
   - Return value in minutes (not hours or seconds)
   - Minimum prep time should be at least 5 minutes for any recipe with ingredients to prepare

HANDLING MESSY DATA:
- Remove HTML tags, extra whitespace, and formatting
- Ignore ads, navigation, comments, and unrelated content
- If data is ambiguous, make reasonable inferences
- If critical data is missing, use sensible defaults (empty arrays, null values)
- Preserve original meaning even if formatting is inconsistent

11. VIDEO RECIPES (TikTok, Instagram Reels, etc.):
   - For video recipe platforms, extract recipe information from:
     * Video description/caption text (PRIORITY: Look for content in elements with class "tiktok-description" or similar)
     * Meta descriptions and og:description tags (these often contain the full recipe description)
     * Comments that contain recipe details
     * Text overlays in the video (if available in HTML)
   - TikTok descriptions often contain:
     * Recipe title at the beginning
     * Ingredients list (may be in various formats: bullet points, numbered, comma-separated, or in text)
     * Instructions/steps (may be brief or detailed)
   - CRITICAL: Parse the description text carefully - ingredients might be written as "2 cups flour, 1 tsp salt" or "flour\nsalt\nsugar" or "• flour\n• salt"
   - Extract ingredients even if they're embedded in the description text, not in a structured list
   - Extract steps/instructions from the description if present
   - If recipe information is incomplete or unavailable, that's okay - the recipe will be saved as a "video recipe" reference
   - Always include the "video recipe" tag for TikTok URLs
   - Extract the video title from og:title or page title (often the first line of the description)
   - Extract the video thumbnail/image from og:image (this is the video screenshot/cover)

OUTPUT FORMAT:
Return ONLY the JSON object, no markdown, no code blocks, no explanations. The JSON must be valid and parseable.

Raw HTML content:
`;

/**
 * Parse JSON-LD structured data from HTML
 * Returns recipe data if found, null otherwise
 */

function parseJSONLD(
  html: string
): Partial<Omit<Recipe, "id" | "createdAt">> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const raw = scripts.eq(i).html();
    if (!raw) continue;

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const nodes = data["@graph"]
      ? data["@graph"]
      : Array.isArray(data)
      ? data
      : [data];

    for (const node of nodes) {
      if (
        node["@type"] !== "Recipe" &&
        node["@type"] !== "https://schema.org/Recipe"
      ) {
        continue;
      }

      const author = Array.isArray(node.author)
        ? node.author[0]?.name
        : typeof node.author === "string"
        ? node.author
        : node.author?.name;

      return {
        title: typeof node.name === "string" ? node.name : node.headline || "",

        coverImage: Array.isArray(node.image)
          ? node.image[0]
          : typeof node.image === "string"
          ? node.image
          : "",

        // ✅ LOSSLESS: keep raw strings
        ingredients: Array.isArray(node.recipeIngredient)
          ? node.recipeIngredient.map((ing: string) => ({
              name: ing,
              quantity: 1,
              unit: "",
              isChecked: false,
            }))
          : [],

        steps: Array.isArray(node.recipeInstructions)
          ? node.recipeInstructions.map((step: any, idx: number) => ({
              id: `step-${idx + 1}`,
              instruction: typeof step === "string" ? step : step.text || "",
              isCompleted: false,
              isBeginnerFriendly: true,
            }))
          : [],

        nutritionalInfo: node.nutrition
          ? {
              calories: parseNumber(node.nutrition.calories),
              protein: parseNumber(node.nutrition.proteinContent),
              carbohydrates: parseNumber(node.nutrition.carbohydrateContent),
              fat: parseNumber(node.nutrition.fatContent),
              fiber: parseNumber(node.nutrition.fiberContent),
              sugar: parseNumber(node.nutrition.sugarContent),
              sodium: parseNumber(node.nutrition.sodiumContent),
            }
          : {},

        originalAuthor: author || "Unknown",
        tags: [],
        categoryIds: [],
        sourceUrl: "",
      };
    }
  }

  return null;
}

function extractRecipeSection(html: string): string | null {
  const $ = cheerio.load(html);

  const selectors = [
    "#recipe",
    ".recipe",
    ".recipe-card",
    ".recipe-content",
    "[itemtype*='Recipe']",
  ];

  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) {
      return el.html() || null;
    }
  }

  return null;
}

function parseNumber(value: any): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? undefined : num;
}

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
  // Reduced to 30k characters for faster processing - most recipe content fits in this
  const maxLength = 50000;
  const truncatedContent =
    htmlContent.length > maxLength
      ? htmlContent.substring(0, maxLength) + "\n\n[Content truncated...]"
      : htmlContent;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4.1", // Using GPT-4.1 for faster, cost-effective results
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
        max_tokens: 3000, // Reduced from 4000 - sufficient for most recipes
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
 * Extract the original recipe URL from a Pinterest pin page
 * Pinterest pins contain the original URL in various meta tags and data structures
 */
async function extractOriginalUrlFromPinterest(
  pinterestUrl: string
): Promise<string | null> {
  try {
    const response = await axios.get(pinterestUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    const htmlContent = response.data;

    // Try multiple methods to find the original URL
    // 1. Check og:url meta tag (most reliable)
    const ogUrl = $('meta[property="og:url"]').attr("content");
    if (ogUrl && !ogUrl.includes("pinterest.com") && ogUrl.startsWith("http")) {
      return ogUrl;
    }

    // 2. Check canonical link
    const canonical = $('link[rel="canonical"]').attr("href");
    if (
      canonical &&
      !canonical.includes("pinterest.com") &&
      canonical.startsWith("http")
    ) {
      return canonical;
    }

    // 3. Check for Pinterest's specific meta tags
    const pinterestUrlMeta = $('meta[property="pinterestapp:url"]').attr(
      "content"
    );
    if (
      pinterestUrlMeta &&
      !pinterestUrlMeta.includes("pinterest.com") &&
      pinterestUrlMeta.startsWith("http")
    ) {
      return pinterestUrlMeta;
    }

    // 4. Look for JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonData = JSON.parse(jsonLdScripts.eq(i).html() || "{}");
        if (
          jsonData.url &&
          !jsonData.url.includes("pinterest.com") &&
          jsonData.url.startsWith("http")
        ) {
          return jsonData.url;
        }
        if (
          jsonData.mainEntityOfPage?.url &&
          !jsonData.mainEntityOfPage.url.includes("pinterest.com") &&
          jsonData.mainEntityOfPage.url.startsWith("http")
        ) {
          return jsonData.mainEntityOfPage.url;
        }
        // Check for @id fields in JSON-LD
        if (
          jsonData["@id"] &&
          !jsonData["@id"].includes("pinterest.com") &&
          jsonData["@id"].startsWith("http")
        ) {
          return jsonData["@id"];
        }
      } catch (e) {
        // Skip invalid JSON
        continue;
      }
    }

    // 5. Look for Pinterest's internal data structure in script tags
    // Pinterest often stores data in window.__initialData__ or similar
    const scripts = $("script");
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = scripts.eq(i).html() || "";

      // Look for URL patterns in Pinterest's data structures
      // Pattern: "url":"https://example.com/recipe"
      const urlPattern1 = /"url"\s*:\s*"https?:\/\/(?!.*pinterest\.com)[^"]+"/g;
      const matches1 = scriptContent.match(urlPattern1);
      if (matches1) {
        for (const match of matches1) {
          const url = match.match(/"https?:\/\/[^"]+"/)?.[0]?.replace(/"/g, "");
          if (url && url.startsWith("http") && !url.includes("pinterest.com")) {
            return url;
          }
        }
      }

      // Pattern: "source_url":"https://example.com/recipe"
      const urlPattern2 =
        /"source_url"\s*:\s*"https?:\/\/(?!.*pinterest\.com)[^"]+"/g;
      const matches2 = scriptContent.match(urlPattern2);
      if (matches2) {
        for (const match of matches2) {
          const url = match.match(/"https?:\/\/[^"]+"/)?.[0]?.replace(/"/g, "");
          if (url && url.startsWith("http") && !url.includes("pinterest.com")) {
            return url;
          }
        }
      }

      // Pattern: "link":"https://example.com/recipe"
      const urlPattern3 =
        /"link"\s*:\s*"https?:\/\/(?!.*pinterest\.com)[^"]+"/g;
      const matches3 = scriptContent.match(urlPattern3);
      if (matches3) {
        for (const match of matches3) {
          const url = match.match(/"https?:\/\/[^"]+"/)?.[0]?.replace(/"/g, "");
          if (url && url.startsWith("http") && !url.includes("pinterest.com")) {
            return url;
          }
        }
      }
    }

    // 6. Search the raw HTML for common URL patterns (fallback)
    const urlPattern =
      /https?:\/\/(?!.*pinterest\.com)(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s"'>]*)?/g;
    const allUrls = htmlContent.match(urlPattern);
    if (allUrls) {
      // Filter out Pinterest URLs and common non-recipe URLs
      const recipeUrls = allUrls.filter((url: string) => {
        const lowerUrl = url.toLowerCase();
        return (
          !lowerUrl.includes("pinterest.com") &&
          !lowerUrl.includes("facebook.com") &&
          !lowerUrl.includes("twitter.com") &&
          !lowerUrl.includes("instagram.com") &&
          !lowerUrl.includes("youtube.com") &&
          !lowerUrl.includes("google.com") &&
          !lowerUrl.includes("amazon.com") &&
          !lowerUrl.includes("cdn") &&
          !lowerUrl.includes("static") &&
          url.startsWith("http")
        );
      });

      if (recipeUrls.length > 0) {
        // Return the first URL that looks like a recipe/blog URL
        return recipeUrls[0];
      }
    }

    return null;
  } catch (error: any) {
    console.warn(
      "Failed to extract original URL from Pinterest:",
      error.message
    );
    return null;
  }
}

/**
 * Check if a URL is a Pinterest URL
 */
function isPinterestUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("pinterest.com") ||
      urlObj.hostname.includes("pinterest.ca") ||
      urlObj.hostname.includes("pinterest.co.uk") ||
      urlObj.hostname.includes("pinterest.")
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a TikTok URL
 */
function isTikTokUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("tiktok.com") ||
      urlObj.hostname.includes("vm.tiktok.com") ||
      urlObj.hostname.includes("vt.tiktok.com")
    );
  } catch {
    return false;
  }
}

/**
 * Get TikTok video metadata using oEmbed API
 * Returns: { title, author_name, thumbnail_url }
 */
async function getTikTokOEmbed(tiktokUrl: string): Promise<{
  title: string;
  author_name: string;
  thumbnail_url: string;
} | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
      tiktokUrl
    )}`;
    const response = await axios.get(oembedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    if (response.data) {
      return {
        title: response.data.title || "",
        author_name: response.data.author_name || "Unknown",
        thumbnail_url: response.data.thumbnail_url || "",
      };
    }
    return null;
  } catch (error: any) {
    console.warn("Failed to fetch TikTok oEmbed:", error.message);
    return null;
  }
}

/**
 * Extract recipe from URL using web scraping and LLM
 */
export const extractRecipeFromUrl = functions
  .region("us-central1")
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

    // Check if this is a Pinterest URL and extract the original URL
    let actualRecipeUrl = data.url;
    const isTikTok = isTikTokUrl(data.url);

    if (isPinterestUrl(data.url)) {
      console.log("Detected Pinterest URL, extracting original recipe URL...");
      const originalUrl = await extractOriginalUrlFromPinterest(data.url);
      if (originalUrl) {
        console.log(`Extracted original URL from Pinterest: ${originalUrl}`);
        actualRecipeUrl = originalUrl;
      } else {
        console.warn(
          "Could not extract original URL from Pinterest, using Pinterest URL"
        );
        // Continue with Pinterest URL if we can't extract the original
      }
    }

    // Normalize URL for caching (remove trailing slashes, fragments, etc.)
    // Use the original Pinterest URL for cache key to avoid duplicate caching
    const normalizedUrl = data.url
      .trim()
      .replace(/\/$/, "")
      .split("#")[0]
      .split("?")[0];
    // Include version in cache key to invalidate cache when extraction logic changes
    const CACHE_VERSION = "v2"; // Increment this when extraction logic changes significantly
    const cacheKey = `recipe-cache-${CACHE_VERSION}-${Buffer.from(normalizedUrl)
      .toString("base64")
      .replace(/[+/=]/g, "")}`;

    // Check cache first (cache expires after 7 days)
    // Gracefully handle if Firestore is not enabled
    try {
      const db = admin.firestore();
      const cacheRef = db.collection("recipeCache").doc(cacheKey);
      const cachedDoc = await cacheRef.get();

      if (cachedDoc.exists) {
        const cachedData = cachedDoc.data();
        const cacheAge = Date.now() - cachedData!.cachedAt.toMillis();
        const cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        if (cacheAge < cacheExpiry) {
          console.log(`Cache hit for URL: ${normalizedUrl}`);
          // Update sourceUrl to the actual recipe URL if it was from Pinterest
          const cachedRecipe = cachedData!.recipe;
          if (isPinterestUrl(data.url) && actualRecipeUrl !== data.url) {
            cachedRecipe.sourceUrl = actualRecipeUrl;
          }
          return cachedRecipe;
        } else {
          // Cache expired, delete it
          await cacheRef.delete();
        }
      }
    } catch (cacheError: any) {
      // If Firestore is not enabled or unavailable, continue without caching
      if (
        cacheError.code === "failed-precondition" ||
        cacheError.message?.includes("SERVICE_DISABLED")
      ) {
        console.warn(
          "Firestore not available, continuing without cache:",
          cacheError.message
        );
      } else {
        // Log other cache errors but don't fail the request
        console.warn(
          "Cache check failed, continuing without cache:",
          cacheError.message
        );
      }
    }

    try {
      // Fetch HTML content from the actual recipe URL (not Pinterest)
      const response = await axios.get(actualRecipeUrl, {
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

      // For TikTok, get metadata from oEmbed API and extract description from page
      let tiktokDescription = "";
      let tiktokOEmbed: {
        title: string;
        author_name: string;
        thumbnail_url: string;
      } | null = null;

      if (isTikTok) {
        // Get metadata from TikTok oEmbed API
        tiktokOEmbed = await getTikTokOEmbed(actualRecipeUrl);
        console.log("TikTok oEmbed data:", tiktokOEmbed);

        // Extract description from meta tags for recipe parsing
        tiktokDescription =
          $('meta[property="og:description"]').attr("content") ||
          $('meta[name="description"]').attr("content") ||
          "";

        // Try to extract description from TikTok's JSON data in script tags
        if (!tiktokDescription) {
          const scripts = $("script");
          for (let i = 0; i < scripts.length; i++) {
            const scriptContent = scripts.eq(i).html() || "";
            try {
              const jsonMatch = scriptContent.match(
                /window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+?});/s
              );
              if (jsonMatch) {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (
                  jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo
                    ?.itemStruct?.desc
                ) {
                  tiktokDescription =
                    jsonData.__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo
                      .itemStruct.desc;
                  break;
                }
              }

              // Look for description in any JSON structure
              const descPattern = /"desc"\s*:\s*"([^"]+)"/;
              const descMatch = scriptContent.match(descPattern);
              if (descMatch && !tiktokDescription) {
                tiktokDescription = descMatch[1]
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"');
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }

        console.log(
          "TikTok extracted description:",
          tiktokDescription.substring(0, 200)
        );
      }

      // Remove script, style, and non-essential elements first
      $(
        "script, style, noscript, iframe, embed, object, video, audio, .comments, .comment, #comments"
      ).remove();

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

      // For TikTok, prepend the description to help LLM extract recipe info
      if (isTikTok && tiktokDescription) {
        htmlContent = `<div class="tiktok-description">${tiktokDescription}</div>\n${htmlContent}`;
      }

      // Clean up HTML: remove excessive whitespace but preserve structure
      htmlContent = htmlContent
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();

      const jsonLdData = parseJSONLD(response.data);
      const recipeSectionHtml = extractRecipeSection(response.data);
      let extractedData: Omit<Recipe, "id" | "createdAt">;

      if (jsonLdData) {
        console.log("Using JSON-LD data for recipe extraction");

        extractedData = {
          title: jsonLdData.title || "",
          coverImage: jsonLdData.coverImage || "",
          ingredients: jsonLdData.ingredients || [],
          steps: jsonLdData.steps || [],
          nutritionalInfo: jsonLdData.nutritionalInfo || {},
          sourceUrl: actualRecipeUrl,
          originalAuthor: jsonLdData.originalAuthor || "Unknown",
          tags: jsonLdData.tags || [],
          categoryIds: jsonLdData.categoryIds || [],
          ...(jsonLdData.prepTime !== undefined && {
            prepTime: jsonLdData.prepTime,
          }),
        };

        // 🔧 JSON-LD incomplete → supplement with AI
        if (!extractedData.ingredients.length || !extractedData.steps.length) {
          console.log("JSON-LD incomplete, supplementing with AI extraction");

          const aiHtml = recipeSectionHtml || htmlContent; // 👈 KEY FIX
          const aiData = await callLLM(aiHtml, actualRecipeUrl);

          extractedData = {
            ...extractedData,
            ingredients: extractedData.ingredients.length
              ? extractedData.ingredients
              : aiData.ingredients,
            steps: extractedData.steps.length
              ? extractedData.steps
              : aiData.steps,
            nutritionalInfo: Object.keys(extractedData.nutritionalInfo).length
              ? extractedData.nutritionalInfo
              : aiData.nutritionalInfo,
            coverImage: extractedData.coverImage || aiData.coverImage,
          };
        }
      } else {
        // ❌ No JSON-LD → try DOM recipe section first
        console.log("No JSON-LD found");

        const aiHtml = recipeSectionHtml || htmlContent; // 👈 KEY FIX
        console.log(
          recipeSectionHtml
            ? "Using extracted recipe section for AI"
            : "Using full HTML for AI"
        );

        extractedData = await callLLM(aiHtml, actualRecipeUrl);
      }

      // For TikTok, override title, image, and author from oEmbed API
      if (isTikTok && tiktokOEmbed) {
        extractedData.title =
          tiktokOEmbed.title || extractedData.title || "TikTok Recipe Video";
        extractedData.coverImage =
          tiktokOEmbed.thumbnail_url || extractedData.coverImage || "";
        extractedData.originalAuthor =
          tiktokOEmbed.author_name || extractedData.originalAuthor || "Unknown";
      }

      // Ensure video recipe tag for TikTok
      if (isTikTok && !extractedData.tags?.includes("video recipe")) {
        extractedData.tags = [...(extractedData.tags || []), "video recipe"];
      }

      // Calculate prep time if not provided
      let prepTime = extractedData.prepTime;
      if (!prepTime && extractedData.steps && extractedData.steps.length > 0) {
        // Estimate prep time based on steps (simple heuristic)
        prepTime = Math.max(5, extractedData.steps.length * 3);
      }

      const recipe: Omit<Recipe, "id" | "createdAt"> = {
        title: extractedData.title || "Untitled Recipe",
        coverImage: extractedData.coverImage || "",
        ingredients: extractedData.ingredients || [],
        steps: extractedData.steps || [],
        nutritionalInfo: extractedData.nutritionalInfo || {},
        sourceUrl: actualRecipeUrl,
        originalAuthor: extractedData.originalAuthor || "Unknown",
        tags: extractedData.tags || [],
        categoryIds: extractedData.categoryIds || [],
        ...(prepTime !== undefined && { prepTime }),
      };

      // Cache the result for future requests (if Firestore is available)
      try {
        const db = admin.firestore();
        const cacheRef = db.collection("recipeCache").doc(cacheKey);
        await cacheRef.set({
          recipe,
          cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          url: normalizedUrl,
        });
        console.log(`Cached recipe for URL: ${normalizedUrl}`);
      } catch (cacheError: any) {
        // Don't fail the request if caching fails
        if (
          cacheError.code === "failed-precondition" ||
          cacheError.message?.includes("SERVICE_DISABLED")
        ) {
          console.warn(
            "Firestore not available, skipping cache:",
            cacheError.message
          );
        } else {
          console.warn("Failed to cache recipe:", cacheError.message);
        }
      }

      return recipe;
    } catch (error: any) {
      // Handle TikTok fallback
      if (isTikTok) {
        try {
          // Still create a basic recipe entry for TikTok
          const basicRecipe: Omit<Recipe, "id" | "createdAt"> = {
            title: "TikTok Recipe Video",
            coverImage: "",
            ingredients: [],
            steps: [
              {
                id: "step-1",
                instruction: `Watch the video recipe at: ${data.url}`,
                isCompleted: false,
                isBeginnerFriendly: true,
              },
            ],
            nutritionalInfo: {},
            sourceUrl: data.url,
            originalAuthor: "Unknown",
            tags: ["video recipe"],
            categoryIds: [],
          };
          return basicRecipe;
        } catch (fallbackError: any) {
          console.error(
            "Failed to create minimal TikTok recipe:",
            fallbackError
          );
        }
      }

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
        // Provide more detailed error message
        const errorMessage = error.message || "Unknown error occurred";
        console.error("Detailed error:", errorMessage);
        throw new functions.https.HttpsError(
          "internal",
          `Failed to extract recipe: ${errorMessage}`
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
        model: "gpt-4.1-mini", // Using GPT-4.1-mini for faster, cost-effective results
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
        max_tokens: 1500, // Reduced from 2000 - nutrition data is relatively small
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
  .region("us-central1")
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

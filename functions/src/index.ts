import { ImageAnnotatorClient } from "@google-cloud/vision";
import axios from "axios";
import * as cheerio from "cheerio";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import sharp from "sharp";

// Initialize Firebase Admin
admin.initializeApp();

// Define the secrets for API Keys
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

/**
 * TypeScript interfaces matching the client-side Recipe interface
 */
interface Ingredient {
  name: string;
  quantity: number | null;
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
  isPerServing?: boolean;
  [key: string]: number | boolean | undefined;
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
  prepTime?: number | null; // Prep time in minutes (active prep time)
  cookTime?: number | null; // Cook time in minutes
  totalTime?: number | null; // Total time in minutes (prep + cook)
  servings?: number | null; // Number of servings the recipe makes
  createdAt: admin.firestore.Timestamp | Date;
}

/**
 * LLM Prompt for extracting structured recipe data from messy HTML
 *
 * This prompt is designed to be used with OpenAI GPT models.
 * It handles messy, unstructured recipe data from various websites.
 */
/**
 * Simplified prompt for social media posts (TikTok/Instagram)
 * These posts have recipe info in plain text captions, not structured HTML
 */
const SOCIAL_MEDIA_EXTRACTION_PROMPT = `Extract recipe information from this social media post caption. Output ONLY valid JSON.

CRITICAL: If the content does NOT contain an actual recipe with ingredients and/or cooking instructions, you MUST return:
{ "noRecipeFound": true, "reason": "brief explanation" }

DO NOT invent or make up recipes. Only extract recipes that are explicitly present in the text.

If a recipe IS found, return:
{
  "noRecipeFound": false,
  "title": string (the dish name - look for the actual food name, not hashtags or promo text),
  "ingredients": Array<{ "name": string, "quantity": number | null, "unit": string, "isChecked": false }>,
  "steps": Array<{ "id": string, "instruction": string, "isCompleted": false, "isBeginnerFriendly": true, "timerDuration": number | null, "title": null }>,
  "nutritionalInfo": {},
  "sourceUrl": "",
  "originalAuthor": "",
  "tags": string[],
  "categoryIds": [],
  "prepTime": null,
  "servings": null
}

RULES:
- Title: Find the actual dish name (e.g., "Garlic Butter Pasta", "Chocolate Cake"). Ignore hashtags, emojis, promo text.
- Ingredients: Parse quantities like "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }. Handle fractions (1/2 = 0.5).
- Steps: Create clear, actionable steps. Generate IDs like "step-1", "step-2". If instructions mention timing (e.g., "cook for 5 min"), set timerDuration in seconds.
- Tags: Extract relevant tags like "easy", "quick", "dessert", cuisine types, etc.
- If the text is just a list of recipe links, a menu, or promotional content WITHOUT actual recipe details, set noRecipeFound: true.

Caption:
`;

const RECIPE_EXTRACTION_PROMPT = `You are an expert recipe data extraction assistant. Your task is to extract structured recipe information from raw HTML content and output it as a JSON object.

CRITICAL: If the page does NOT contain an actual recipe (e.g., it's a list of recipe links, a category page, a homepage, or promotional content without specific ingredients/instructions), you MUST return:
{ "noRecipeFound": true, "reason": "brief explanation" }

DO NOT invent or make up recipes. Only extract recipes that are explicitly present in the content.

IMPORTANT: If a recipe IS found, output ONLY valid JSON that matches this exact TypeScript interface:

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
    "sodium": number | null (in milligrams),
    "isPerServing": boolean | null (true if nutrition is per serving, false if for whole recipe, null if unknown)
  },
  "sourceUrl": string,
  "originalAuthor": string,
  "tags": string[],
  "categoryIds": string[] (empty array if unknown),
  "prepTime": number | null (in minutes, optional - active prep time only),
  "servings": number | null (number of servings the recipe makes, e.g., 4, 6, 8)
}

EXTRACTION RULES:

1. TITLE:
   - Extract the main recipe title - this should be the NAME OF THE DISH (e.g., "Chicken Alfredo", "Chocolate Chip Cookies", "Beef Tacos")
   - For traditional recipe websites: Look in <h1>, <h2>, or meta tags (og:title, twitter:title)
   - For social media posts (TikTok, Instagram): The title is usually NOT the first line of the caption. Instead:
     * Look through the ENTIRE caption/description text for the actual dish name
     * The recipe name often appears: before the ingredients list, after phrases like "here's my", "try this", "making", "how to make", or stands alone on its own line
     * Look for food-related words that form a dish name (e.g., "pasta", "chicken", "cake", "soup", "salad", etc.)
     * Ignore hashtags, emojis, promotional text, and generic phrases like "recipe", "easy recipe", "viral recipe"
     * If the caption mentions a specific dish name anywhere (even in the middle), use that as the title
   - Clean up extra whitespace, emojis, and "Recipe:" prefixes
   - The title should be a proper dish name, NOT the first sentence of a caption or promotional text
   - If you cannot find a specific dish name, infer it from the main ingredients (e.g., ingredients with chicken and pasta → "Chicken Pasta")

2. COVER IMAGE:
   - Look for images in this priority: og:image, twitter:image, first large <img> in content
   - Prefer images with "recipe", "food", or "dish" in alt text
   - Extract full URL (resolve relative URLs to absolute)
   - If no image found, use empty string ""

3. INGREDIENTS:
   - CRITICAL: Locate the ingredient list section in the HTML. Look for headings like "Ingredients", "Ingredients You'll Need", "For the [X]", or similar. The ingredient list is usually in a <ul>, <ol>, or <div> with classes like "ingredients", "recipe-ingredients", "ingredient-list", etc.
   - CRITICAL: Extract the ACTUAL quantity and unit from each ingredient line.
   - Parse ingredient lists from various formats (do not round):
     * "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
     * "1/2 tsp salt" → { name: "salt", quantity: 0.5, unit: "tsp" }
     * "1/4 cup butter" → { name: "butter", quantity: 0.25, unit: "cup" }
     * "1 egg" → { name: "egg", quantity: 1, unit: "egg" } (NOT cups!)
     * "3 large eggs" → { name: "eggs", quantity: 3, unit: "large" }
     * "salt, to taste" → { name: "salt", quantity: null, unit: "to taste" } (ONLY when explicitly stated)
     * "pepper (optional)" → { name: "pepper", quantity: null, unit: "to taste" } (if no quantity given and optional)
   - CRITICAL: Whole items like eggs, pieces, items should NEVER be converted to volume units (cups, tsp, etc.)
   - For whole items: use unit "egg", "eggs", "piece", "pieces", "whole", "item", or descriptive size like "large", "medium", "small"
   - Handle fractions: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, etc. (for volume/weight units only)
   - Handle ranges: "2-3 cups" → Print as written (e.g., "2-3 cups")
   - Handle "to taste", "as needed", "optional" → quantity: null, unit: "to taste" (ONLY when no quantity is specified and recipe says "to taste" or similar)
   - If a quantity is clearly stated in the recipe, extract it exactly - do NOT default to "to taste"
   - Look carefully for quantities even if they're written in different formats (e.g., "two cups", "2 c.", "2c", etc.)
   - IMPORTANT: Look for WordPress Recipe Maker (WPRM) classes first:
     * .wprm-recipe-ingredient-group - contains groups of ingredients
     * .wprm-recipe-ingredient - individual ingredient items  
     * .wprm-recipe-ingredient-amount - the quantity
     * .wprm-recipe-ingredient-unit - the unit
     * .wprm-recipe-ingredient-name - the ingredient name
   - Extract from common selectors: [data-ingredient], .ingredient, .recipe-ingredient, <li> in ingredient lists, or any list items under an "Ingredients" heading
   - Each ingredient should be on its own line or list item
   - Clean ingredient names: remove quantities, units, and extra text (parenthetical notes can stay if they're part of the ingredient name)
   - Always set isChecked to false
   - IMPORTANT: If you see an ingredient list with clear quantities (like "2 cups flour", "1/2 tsp salt"), extract those exact quantities. Do not assume "to taste" unless the recipe explicitly says so.

4. STEPS:
   - CRITICAL: Find the section that contains instructions (this is usually just below the ingredient list), then extract ALL cooking instructions - do not skip or omit any steps
   - Extract from ordered/unordered lists, paragraphs, or structured data
   - IMPORTANT: Look for WordPress Recipe Maker (WPRM) classes first:
     * .wprm-recipe-instruction-group - contains groups of instructions
     * .wprm-recipe-instruction - individual instruction items
     * .wprm-recipe-instruction-text - the actual instruction text
   - Also look for: <ol>, <ul> with class containing "step", "instruction", "direction"
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
   - IMPORTANT: Look for WordPress Recipe Maker (WPRM) nutrition classes:
     * .wprm-nutrition-label-container or .wprm-internal-container-nutrition - main nutrition container
     * .wprm-nutrition-label-text-nutrition-value - individual nutrition values
     * Classes like wprm-nutrition-label-text-nutrition-container-calories, -protein, -carbohydrates, -fat, -fiber, -sugar, -sodium
   - Look for patterns: "Calories: 250", "Protein 10g", "Calories: 450kcal", etc.
   - Convert units: ensure protein/carbs/fat in grams, sodium in mg
   - CRITICAL: Check if nutrition is labeled as "per serving", "per portion", "per slice", or similar
   - If nutrition table/header says "per serving" or "Nutrition per serving" or similar, set isPerServing: true
   - If nutrition is clearly for the whole recipe (e.g., "Total Nutrition", "Recipe Nutrition"), set isPerServing: false
   - If unclear, check if values seem reasonable: very low calories (50-300) might indicate per serving, while high values (500+) might be whole recipe
   - If not found, set to null (not 0)

6. SOURCE URL:
   - Use the provided URL (already known)

7. ORIGINAL AUTHOR:
   - Extract from: author meta tags, "By [Name]", recipe card author fields
   - If not found, use "Unknown" or website name

8. TAGS:
   - Generate relevant tags from BROAD CATEGORIES only:
     * Recipe type/meal: "dessert", "appetizer", "breakfast", "lunch", "dinner", "snack", "brunch"
     * Cuisine: "italian", "mexican", "japanese", "french", "thai", "indian", "greek", "chinese", "american", "mediterranean", "korean", "spanish", "vietnamese", "middle-eastern"
     * Dietary: "vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo", "low-carb", "nut-free", "sugar-free"
     * Cooking method: "baked", "grilled", "slow-cooked", "fried", "steamed", "roasted"
     * Special categories: "one pot meal" (if recipe is cooked entirely in one pot/pan/skillet - check title and instructions for "one pot", "one pan", "all in one", or instructions that indicate everything is cooked together in a single vessel). Use "one pot meal" (not "one-pan" or "one pan") as the tag.
     * IMPORTANT: Only tag as "sugar-free" if the recipe explicitly states it is sugar-free (e.g., "sugar-free", "no sugar", "without sugar"). Do NOT infer sugar-free from low sugar content alone.
   - CRITICAL: Do NOT tag specific food items or dish names (e.g., "enchilada", "lasagna", "burger", "pizza", "sushi", "taco"). Only use broad category tags listed above.
   - Extract from meta keywords, categories, or infer from content
   - Minimum 2-3 tags, maximum 8 tags
   - Do NOT add "low-sugar" tag if "sugar-free" tag is already present

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
     * Video description/caption text (PRIORITY: Look for content in elements with class "social-media-description" or "tiktok-description")
     * Meta descriptions and og:description tags (these often contain the full recipe description)
     * Comments that contain recipe details
     * Text overlays in the video (if available in HTML)
   - TITLE EXTRACTION FOR VIDEO RECIPES (CRITICAL):
     * Do NOT use the first line of the caption as the title - this is usually just intro text
     * Read through the ENTIRE caption to find the actual dish name
     * Look for the dish name in these common patterns:
       - Before ingredients (e.g., "Garlic Butter Shrimp\n\nIngredients:")
       - After intro phrases (e.g., "Here's my famous Chicken Alfredo recipe!")
       - After "making" or "how to make" (e.g., "Making the BEST chocolate chip cookies")
       - Standalone line that names a food (e.g., a line that just says "Birria Tacos")
       - Near the end before hashtags (e.g., "...and that's my Easy Pasta Bake! #recipe")
     * The title should be a proper dish name like "Garlic Butter Shrimp", "Chicken Alfredo", "Birria Tacos"
     * NOT generic text like "This recipe is so good", "You need to try this", or "Easy weeknight dinner"
     * If no explicit dish name is found, create one from the main protein + cooking style or main ingredients
   - TikTok/Instagram descriptions often contain:
     * Intro text or hook (SKIP THIS for title)
     * Recipe name somewhere in the text (USE THIS for title)
     * Ingredients list (may be in various formats: bullet points, numbered, comma-separated, or in text)
     * Instructions/steps (may be brief or detailed)
     * Hashtags at the end (ignore for title)
   - CRITICAL: Parse the description text carefully - ingredients might be written as "2 cups flour, 1 tsp salt" or "flour\nsalt\nsugar" or "• flour\n• salt"
   - Extract ingredients even if they're embedded in the description text, not in a structured list
   - Extract steps/instructions from the description if present
   - If recipe information is incomplete or unavailable, that's okay - the recipe will be saved as a "video recipe" reference
   - Always include the "video recipe" tag for TikTok/Instagram URLs
   - Extract the video thumbnail/image from og:image (this is the video screenshot/cover)

OUTPUT FORMAT:
Return ONLY the JSON object, no markdown, no code blocks, no explanations. The JSON must be valid and parseable.

Raw HTML content:
`;

function parseInstructions(raw: any): Step[] {
  const steps: Step[] = [];

  if (!raw) return steps;

  const blocks = Array.isArray(raw) ? raw : [raw];

  let stepIndex = 1;

  for (const block of blocks) {
    // Plain string
    if (typeof block === "string") {
      steps.push({
        id: `step-${stepIndex++}`,
        instruction: block,
        isCompleted: false,
        isBeginnerFriendly: true,
      });
      continue;
    }

    // HowToStep
    if (block["@type"] === "HowToStep" && block.text) {
      steps.push({
        id: `step-${stepIndex++}`,
        instruction: block.text,
        isCompleted: false,
        isBeginnerFriendly: true,
      });
      continue;
    }

    // HowToSection (VERY common)
    if (block.itemListElement && Array.isArray(block.itemListElement)) {
      for (const item of block.itemListElement) {
        if (item.text) {
          steps.push({
            id: `step-${stepIndex++}`,
            instruction: item.text,
            isCompleted: false,
            isBeginnerFriendly: true,
          });
        }
      }
    }
  }

  return steps;
}

// function extractAuthor(node: any): string | undefined {
//   const author = node.author;

//   if (!author) return undefined;

//   if (typeof author === "string") return author;

//   if (Array.isArray(author)) {
//     const first = author[0];
//     if (typeof first === "string") return first;
//     return first?.name;
//   }

//   if (typeof author === "object") {
//     return author.name || author["@name"];
//   }

//   return undefined;
// }

// function parseISODuration(value?: string): number | undefined {
//   if (!value || typeof value !== "string") return undefined;

//   const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
//   if (!match) return undefined;

//   const hours = match[1] ? parseInt(match[1], 10) : 0;
//   const minutes = match[2] ? parseInt(match[2], 10) : 0;

//   const total = hours * 60 + minutes;
//   return total > 0 ? total : undefined;
// }

/**
 * Parse JSON-LD structured data from HTML
 * Returns recipe data if found, null otherwise
 */

function parseJSONLD(
  $: cheerio.CheerioAPI
): Partial<Omit<Recipe, "id" | "createdAt">> | null {
  const scripts = $('script[type="application/ld+json"]');

  // Helper: parse ISO 8601 duration → minutes
  const parseDurationToMinutes = (value?: string): number | null => {
    if (!value || typeof value !== "string") return null;

    const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!match) return null;

    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;

    return hours * 60 + minutes;
  };

  // Helper: extract author name safely
  const extractAuthor = (node: any, fallbackSiteName?: string): string => {
    const author = node.author;

    if (typeof author === "string") return author;

    if (Array.isArray(author)) {
      return (
        author.find((a) => typeof a?.name === "string")?.name ||
        fallbackSiteName ||
        "Unknown"
      );
    }

    if (typeof author?.name === "string") {
      return author.name;
    }

    return fallbackSiteName || "Unknown";
  };

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

    // Grab site name from WebSite / Organization nodes
    const siteName =
      nodes.find((n: any) => n["@type"] === "WebSite")?.name ||
      nodes.find((n: any) => n["@type"] === "Organization")?.name ||
      undefined;

    for (const node of nodes) {
      if (
        node["@type"] !== "Recipe" &&
        node["@type"] !== "https://schema.org/Recipe"
      ) {
        continue;
      }

      const authorName = extractAuthor(node, siteName);

      return {
        title: typeof node.name === "string" ? node.name : "",

        coverImage: Array.isArray(node.image)
          ? node.image[0]
          : typeof node.image === "string"
          ? node.image
          : "",

        ingredients: Array.isArray(node.recipeIngredient)
          ? node.recipeIngredient.map((ing: any) => {
              const parsed = parseIngredientString(ing);
              return {
                name: parsed.name,
                quantity: parsed.quantity,
                unit: parsed.unit,
                isChecked: false,
              };
            })
          : [],

        steps: parseInstructions(node.recipeInstructions),

        // ⏱️ TIME FIELDS (minutes)
        prepTime: parseDurationToMinutes(node.prepTime),
        cookTime: parseDurationToMinutes(node.cookTime),
        totalTime: parseDurationToMinutes(node.totalTime),

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

        originalAuthor: authorName,
        tags: [],
        categoryIds: [],
        sourceUrl: "",
      };
    }
  }

  return null;
}

function extractAuthorAndTimesFromDOM($: cheerio.CheerioAPI) {
  let author = "";
  let prepTime = null;
  let cookTime = null;
  let totalTime = null;

  // Look for common plain text selectors
  // Example: <div>Author Erin Collins</div>
  const authorText = $("body")
    .text()
    .match(/Author\s*([A-Za-z\s]+)/i);
  if (authorText) {
    author = authorText[1].trim();
  }

  // Look for times like "Prep Time 30", "Cook Time 45", "Total Time 2"
  const prepMatch = $("body")
    .text()
    .match(/Prep Time\s*([\d]+)\s*minutes?/i);
  if (prepMatch) {
    prepTime = parseInt(prepMatch[1], 10);
  }

  const cookMatch = $("body")
    .text()
    .match(/Cook Time\s*([\d]+)\s*minutes?/i);
  if (cookMatch) {
    cookTime = parseInt(cookMatch[1], 10);
  }

  const totalMatch = $("body")
    .text()
    .match(/Total Time\s*([\d]+)\s*hours?/i);
  if (totalMatch) {
    totalTime = parseInt(totalMatch[1], 10) * 60;
  }

  return { author, prepTime, cookTime, totalTime };
}

function extractRecipeSection($: cheerio.CheerioAPI): string | null {
  // 1️⃣ WP Recipe Maker (VERY common) - try multiple selectors
  const wprmSelectors = [
    ".wprm-recipe",
    "[id^='wprm-recipe-container']",
    ".wprm-recipe-container",
  ];

  for (const selector of wprmSelectors) {
    const wprm = $(selector).first();
  if (wprm.length) {
      console.log(`Found WP Recipe Maker section (${selector})`);

      // For WPRM, explicitly include instruction groups and nutrition if they exist
      // Sometimes these are outside the main container
      let content = wprm.html() || "";

      // Check for instruction groups that might be separate
      const instructionGroups = $(
        ".wprm-recipe-instruction-group, .wprm-recipe-instructions"
      );
      if (
        instructionGroups.length &&
        !content.includes("wprm-recipe-instruction")
      ) {
        console.log("Adding WPRM instruction groups to content");
        content +=
          "\n" +
          instructionGroups
            .map((_, el) => $(el).html())
            .get()
            .join("\n");
      }

      // Check for nutrition container
      const nutritionContainer = $(
        ".wprm-nutrition-label-container, .wprm-internal-container-nutrition, .wprm-recipe-nutrition"
      );
      if (nutritionContainer.length && !content.includes("wprm-nutrition")) {
        console.log("Adding WPRM nutrition to content");
        content +=
          "\n" +
          nutritionContainer
            .map((_, el) => $(el).html())
            .get()
            .join("\n");
      }

      // Check for ingredients that might be separate
      const ingredientGroups = $(
        ".wprm-recipe-ingredient-group, .wprm-recipe-ingredients"
      );
      if (
        ingredientGroups.length &&
        !content.includes("wprm-recipe-ingredient")
      ) {
        console.log("Adding WPRM ingredient groups to content");
        content +=
          "\n" +
          ingredientGroups
            .map((_, el) => $(el).html())
            .get()
            .join("\n");
      }

      return content;
    }
  }

  // 3️⃣ Schema.org Recipe (very reliable)
  const schemaRecipe = $("[itemtype*='schema.org/Recipe']").first();
  if (schemaRecipe.length) {
    console.log("Found schema.org Recipe container");
    return schemaRecipe.html();
  }

  // 4️⃣ Tasty Recipes plugin
  const tasty = $(".tasty-recipes, .tasty-recipes-entry").first();
  if (tasty.length) {
    console.log("Found Tasty Recipes section");
    return tasty.html();
  }

  // 5️⃣ Explicit #recipe (keep, but lower priority)
  const recipeDiv = $("#recipe").first();
  if (recipeDiv.length) {
    console.log("Found #recipe div");
    return recipeDiv.html();
  }

  // 6️⃣ Generic recipe-ish classes
  const genericSelectors = [
    ".recipe",
    ".recipe-card",
    ".recipe-content",
    ".post-recipe",
    ".entry-recipe",
  ];

  for (const selector of genericSelectors) {
    const el = $(selector).first();
    if (el.length) {
      console.log(`Found recipe section using selector: ${selector}`);
      return el.html();
    }
  }

  console.log("No dedicated recipe section found");
  return null;
}

function parseNumber(value: any): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Parse ingredient string to extract quantity, unit, and name
 * Handles formats like "4 1/2 cups flour", "2 teaspoons salt", "1/4 cup butter"
 */
function parseIngredientString(ingredientStr: string | any): {
  name: string;
  quantity: number | null;
  unit: string;
} {
  // Handle object format from JSON-LD
  if (typeof ingredientStr === "object" && ingredientStr !== null) {
    const name = ingredientStr.name || ingredientStr.text || "";
    const amount = ingredientStr.amount || ingredientStr.quantity || "";

    if (amount) {
      const parsed = parseIngredientString(`${amount} ${name}`);
      return parsed;
    }

    return {
      name: name,
      quantity: null,
      unit: "",
    };
  }

  const str = String(ingredientStr).trim();
  if (!str) {
    return { name: "", quantity: null, unit: "" };
  }

  // Pattern to match: optional whole number, optional fraction, optional unit, ingredient name
  // Examples: "4 1/2 cups flour", "2 teaspoons salt", "1/4 cup butter", "1 egg"
  // IMPORTANT: Check fraction BEFORE whole number to avoid matching "1" from "1/3"
  const mixedNumberPattern = /^(\d+)\s+(\d+\/\d+)/;
  const fractionPattern = /^(\d+\/\d+)/;
  const decimalPattern = /^(\d+\.\d+)/;
  // Whole number pattern - must NOT be followed by "/" to avoid matching "1" from "1/3"
  const wholeNumberPattern = /^(\d+)(?!\/)/;

  let quantity = null;
  let remaining = str;
  let unit = "";

  // Try to match mixed number first (e.g., "4 1/2")
  const mixedMatch = remaining.match(mixedNumberPattern);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const fraction = mixedMatch[2];
    const [num, den] = fraction.split("/").map(Number);
    quantity = whole + num / den;
    remaining = remaining.substring(mixedMatch[0].length).trim();
  } else {
    // Try fraction FIRST (e.g., "1/3", "1/2") - before whole number to avoid matching "1" from "1/3"
    const fracMatch = remaining.match(fractionPattern);
    if (fracMatch) {
      const [num, den] = fracMatch[1].split("/").map(Number);
      quantity = num / den;
      remaining = remaining.substring(fracMatch[0].length).trim();
    } else {
      // Try decimal (e.g., "1.5")
      const decMatch = remaining.match(decimalPattern);
      if (decMatch) {
        quantity = parseFloat(decMatch[1]);
        remaining = remaining.substring(decMatch[0].length).trim();
      } else {
        // Try whole number (e.g., "2") - but NOT if followed by "/" (already handled by fraction pattern)
        const wholeMatch = remaining.match(wholeNumberPattern);
        if (wholeMatch) {
          quantity = parseInt(wholeMatch[1], 10);
          remaining = remaining.substring(wholeMatch[0].length).trim();
        }
      }
    }
  }

  // Common unit patterns
  const unitPatterns = [
    /^(cups?|cup)\b/i,
    /^(teaspoons?|tsp|tsps?)\b/i,
    /^(tablespoons?|tbsp|tbsps?)\b/i,
    /^(ounces?|oz)\b/i,
    /^(pounds?|lbs?|lb)\b/i,
    /^(grams?|g)\b/i,
    /^(kilograms?|kg)\b/i,
    /^(milliliters?|ml)\b/i,
    /^(liters?|l)\b/i,
    /^(pints?|pt)\b/i,
    /^(quarts?|qt)\b/i,
    /^(gallons?|gal)\b/i,
    /^(pieces?|piece)\b/i,
    /^(whole|item|items?)\b/i,
    /^(large|medium|small)\b/i,
    /^(eggs?|egg)\b/i,
  ];

  // Try to match a unit
  for (const pattern of unitPatterns) {
    const unitMatch = remaining.match(pattern);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
      remaining = remaining.substring(unitMatch[0].length).trim();
      break;
    }
  }

  // Handle "to taste" or "as needed"
  if (
    remaining.toLowerCase().includes("to taste") ||
    remaining.toLowerCase().includes("as needed")
  ) {
    unit = "to taste";
    quantity = null; // Set quantity to null for "to taste" ingredients
    remaining = remaining.replace(/\s*(to taste|as needed)\s*/i, "").trim();
  }

  // The remaining string is the ingredient name
  const name = remaining.trim() || str;

  return { name, quantity, unit };
}

/**
 * Convert ingredient quantity to a base unit for comparison
 * Returns quantity in the smallest common unit
 */
function convertToBaseUnit(
  quantity: number | null,
  unit: string
): {
  quantity: number;
  baseUnit: string;
} {
  // Handle null quantity (shouldn't happen for non-"to taste" ingredients)
  if (quantity === null) {
    return { quantity: 0, baseUnit: "" };
  }

  const normalizedUnit = unit.toLowerCase().trim();

  // Volume conversions (convert to teaspoons as base)
  if (
    normalizedUnit.includes("cup") ||
    normalizedUnit === "cups" ||
    normalizedUnit === "cup"
  ) {
    return { quantity: quantity * 48, baseUnit: "teaspoons" }; // 1 cup = 48 tsp
  }
  if (
    normalizedUnit.includes("tablespoon") ||
    normalizedUnit === "tbsp" ||
    normalizedUnit === "tbsps" ||
    normalizedUnit === "tablespoons"
  ) {
    return { quantity: quantity * 3, baseUnit: "teaspoons" }; // 1 tbsp = 3 tsp
  }
  if (
    normalizedUnit.includes("teaspoon") ||
    normalizedUnit === "tsp" ||
    normalizedUnit === "tsps" ||
    normalizedUnit === "teaspoons"
  ) {
    return { quantity: quantity, baseUnit: "teaspoons" };
  }
  if (
    normalizedUnit.includes("pint") ||
    normalizedUnit === "pt" ||
    normalizedUnit === "pints"
  ) {
    return { quantity: quantity * 96, baseUnit: "teaspoons" }; // 1 pint = 96 tsp
  }
  if (
    normalizedUnit.includes("quart") ||
    normalizedUnit === "qt" ||
    normalizedUnit === "quarts"
  ) {
    return { quantity: quantity * 192, baseUnit: "teaspoons" }; // 1 quart = 192 tsp
  }
  if (
    normalizedUnit.includes("gallon") ||
    normalizedUnit === "gal" ||
    normalizedUnit === "gallons"
  ) {
    return { quantity: quantity * 768, baseUnit: "teaspoons" }; // 1 gallon = 768 tsp
  }
  if (
    normalizedUnit.includes("ounce") ||
    normalizedUnit === "oz" ||
    normalizedUnit === "ounces"
  ) {
    return { quantity: quantity * 6, baseUnit: "teaspoons" }; // 1 fl oz = 6 tsp (approx)
  }

  // Weight conversions (convert to ounces as base)
  if (
    normalizedUnit.includes("pound") ||
    normalizedUnit === "lb" ||
    normalizedUnit === "lbs" ||
    normalizedUnit === "pounds"
  ) {
    return { quantity: quantity * 16, baseUnit: "ounces" }; // 1 lb = 16 oz
  }
  if (
    normalizedUnit.includes("gram") ||
    normalizedUnit === "g" ||
    normalizedUnit === "grams"
  ) {
    return { quantity: quantity / 28.35, baseUnit: "ounces" }; // 1 oz = 28.35g
  }
  if (
    normalizedUnit.includes("kilogram") ||
    normalizedUnit === "kg" ||
    normalizedUnit === "kilograms"
  ) {
    return { quantity: (quantity * 1000) / 28.35, baseUnit: "ounces" }; // 1 kg = 1000g
  }

  // For items that can't be converted (eggs, pieces, etc.), keep as-is
  return { quantity, baseUnit: normalizedUnit || "item" };
}

/**
 * Convert from base unit back to a reasonable display unit
 */
function convertFromBaseUnit(
  quantity: number,
  baseUnit: string,
  originalUnits: string[]
): {
  quantity: number;
  unit: string;
} {
  if (baseUnit === "teaspoons") {
    // Try to convert to the most reasonable unit
    if (quantity >= 48) {
      const cups = quantity / 48;
      if (cups >= 1 && Number.isInteger(cups)) {
        return { quantity: cups, unit: "cups" };
      }
      // Check if we should use cups with fraction
      if (cups >= 1) {
        return { quantity: Math.round(cups * 4) / 4, unit: "cups" }; // Round to nearest 1/4 cup
      }
    }
    if (quantity >= 3) {
      const tbsp = quantity / 3;
      if (Number.isInteger(tbsp)) {
        return { quantity: tbsp, unit: "tablespoons" };
      }
      // Use the original unit if it was tablespoons
      if (
        originalUnits.some(
          (u) =>
            u.toLowerCase().includes("tablespoon") || u.toLowerCase() === "tbsp"
        )
      ) {
        return { quantity: Math.round(tbsp * 2) / 2, unit: "tablespoons" }; // Round to nearest 1/2 tbsp
      }
    }
    return { quantity: Math.round(quantity * 2) / 2, unit: "teaspoons" }; // Round to nearest 1/2 tsp
  }

  if (baseUnit === "ounces") {
    if (quantity >= 16) {
      const lbs = quantity / 16;
      if (Number.isInteger(lbs)) {
        return { quantity: lbs, unit: "pounds" };
      }
      return { quantity: Math.round(lbs * 4) / 4, unit: "pounds" }; // Round to nearest 1/4 lb
    }
    return { quantity: Math.round(quantity * 2) / 2, unit: "ounces" }; // Round to nearest 1/2 oz
  }

  // For non-convertible units, use the most common original unit
  if (originalUnits.length > 0) {
    // Count occurrences of each unit
    const unitCounts: Record<string, number> = {};
    originalUnits.forEach((u) => {
      const normalized = u.toLowerCase().trim();
      unitCounts[normalized] = (unitCounts[normalized] || 0) + 1;
    });
    const mostCommon = Object.entries(unitCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];
    return { quantity, unit: mostCommon[0] };
  }

  return { quantity, unit: baseUnit };
}

/**
 * Combine duplicate ingredients by adding their quantities
 * Handles unit conversion when ingredients have the same name but different units
 */
function combineIngredients(ingredients: Ingredient[]): Ingredient[] {
  if (!ingredients?.length) return [];

  // Group ingredients by normalized name
  const ingredientMap = new Map<
    string,
    {
      quantities: number[];
      baseUnits: string[];
      originalUnits: string[];
      isChecked: boolean;
      displayName: string;
    }
  >();

  // Separate "to taste" ingredients - they won't be combined
  const toTasteIngredients: Ingredient[] = [];
  const regularIngredients: Ingredient[] = [];

  for (const ing of ingredients) {
    // Handle "to taste" ingredients separately - don't combine them
    if (ing.unit === "to taste") {
      toTasteIngredients.push({
        name: ing.name,
        quantity: null,
        unit: "to taste",
        isChecked: ing.isChecked,
      });
      continue;
    }
    regularIngredients.push(ing);
  }

  for (const ing of regularIngredients) {
    // Normalize name (lowercase, trim, remove extra spaces)
    const normalizedName = ing.name.toLowerCase().trim().replace(/\s+/g, " ");

    if (!ingredientMap.has(normalizedName)) {
      ingredientMap.set(normalizedName, {
        quantities: [],
        baseUnits: [],
        originalUnits: [],
        isChecked: ing.isChecked,
        displayName: ing.name, // Keep original casing for display
      });
    }

    const entry = ingredientMap.get(normalizedName)!;

    // Skip if quantity is null (shouldn't happen for non-"to taste" ingredients, but be safe)
    if (ing.quantity === null) {
      continue;
    }

    // Convert to base unit for comparison
    const { quantity: baseQuantity, baseUnit } = convertToBaseUnit(
      ing.quantity,
      ing.unit
    );
    entry.quantities.push(baseQuantity);
    entry.baseUnits.push(baseUnit);
    entry.originalUnits.push(ing.unit);
    // If any instance is checked, mark as checked
    if (ing.isChecked) {
      entry.isChecked = true;
    }
  }

  // Combine ingredients
  const combined: Ingredient[] = [];

  for (const [normalizedName, entry] of ingredientMap.entries()) {
    // Check if all base units are compatible (same category: volume or weight)
    const isVolume = entry.baseUnits[0] === "teaspoons";
    const isWeight = entry.baseUnits[0] === "ounces";
    const allSameCategory = entry.baseUnits.every(
      (unit) =>
        (isVolume && unit === "teaspoons") ||
        (isWeight && unit === "ounces") ||
        (!isVolume && !isWeight && unit === entry.baseUnits[0])
    );

    if (allSameCategory) {
      // All compatible units - can combine
      const totalBaseQuantity = entry.quantities.reduce((sum, q) => sum + q, 0);
      const baseUnit = entry.baseUnits[0];

      // Convert back to display unit
      const { quantity: displayQuantity, unit: displayUnit } =
        convertFromBaseUnit(totalBaseQuantity, baseUnit, entry.originalUnits);

      combined.push({
        name: entry.displayName,
        quantity: displayQuantity,
        unit: displayUnit,
        isChecked: entry.isChecked,
      });
    } else {
      // Different unit categories (e.g., volume vs weight) - can't combine, keep the first one
      const firstIngredient = regularIngredients.find(
        (ing) =>
          ing.name.toLowerCase().trim().replace(/\s+/g, " ") === normalizedName
      );
      if (firstIngredient) {
        combined.push(firstIngredient);
      }
    }
  }

  return combined;
}

/**
 * Call OpenAI API to extract recipe data from HTML content
 */
async function callLLM(
  htmlContent: string,
  sourceUrl: string
): Promise<Omit<Recipe, "id" | "createdAt">> {
  const llmStartTime = Date.now();
  console.log(
    `[TIMING] LLM call starting - input size: ${(
      htmlContent.length / 1024
    ).toFixed(1)}KB`
  );

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

  console.log(
    `[TIMING] LLM input after truncation: ${(
      truncatedContent.length / 1024
    ).toFixed(1)}KB`
  );

  try {
    const apiCallStart = Date.now();
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o", // Using GPT-4o for accurate results
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
    const apiCallDuration = Date.now() - apiCallStart;
    console.log(`[TIMING] OpenAI API call: ${apiCallDuration}ms`);

    // Log token usage if available
    if (response.data.usage) {
      console.log(
        `[TIMING] OpenAI tokens - prompt: ${response.data.usage.prompt_tokens}, completion: ${response.data.usage.completion_tokens}, total: ${response.data.usage.total_tokens}`
      );
    }

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

    const parseStart = Date.now();
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
    console.log(
      `[TIMING] JSON parse of LLM response: ${Date.now() - parseStart}ms`
    );

    // Check if the LLM determined there's no recipe on this page
    if (extractedData.noRecipeFound === true) {
      const reason = extractedData.reason || "No recipe content found";
      console.log(`[LLM] No recipe found: ${reason}`);
      throw new Error(
        `No recipe found on this page. ${reason} Please make sure the link goes directly to a recipe, not a list of recipes.`
      );
    }

    // Validate required fields
    if (!extractedData.title) {
      throw new Error("Extracted data missing required field: title");
    }

    // Ensure sourceUrl is set
    extractedData.sourceUrl = sourceUrl;

    const totalLlmTime = Date.now() - llmStartTime;
    console.log(`[TIMING] Total LLM function time: ${totalLlmTime}ms`);

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
 * Fast LLM call specifically for social media posts (TikTok/Instagram)
 * Uses Groq with Llama 3.3 70B for ultra-fast inference (~10-20x faster than OpenAI)
 */
async function callLLMForSocialMedia(
  captionText: string,
  sourceUrl: string
): Promise<Omit<Recipe, "id" | "createdAt">> {
  const llmStartTime = Date.now();
  console.log(
    `[TIMING] Social media LLM call starting (Groq) - input size: ${captionText.length} chars`
  );

  const apiKeyRaw = GROQ_API_KEY.value();
  if (!apiKeyRaw) {
    throw new Error(
      "GROQ_API_KEY is not configured. Please set it using:\n" +
        "firebase functions:secrets:set GROQ_API_KEY"
    );
  }
  const apiKey = apiKeyRaw.trim().replace(/\s+/g, "");

  try {
    const apiCallStart = Date.now();
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile", // Fast + high quality on Groq
        messages: [
          {
            role: "user",
            content: SOCIAL_MEDIA_EXTRACTION_PROMPT + captionText,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Lower temperature for more consistent results
        max_tokens: 2000, // Social media recipes are typically simpler
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000, // 15 second timeout (Groq is very fast)
      }
    );
    const apiCallDuration = Date.now() - apiCallStart;
    console.log(`[TIMING] Groq API call (social media): ${apiCallDuration}ms`);

    if (response.data.usage) {
      console.log(
        `[TIMING] Groq tokens - prompt: ${response.data.usage.prompt_tokens}, completion: ${response.data.usage.completion_tokens}`
      );
    }

    if (!response.data.choices || response.data.choices.length === 0) {
      throw new Error("No choices in Groq response");
    }

    const responseText = response.data.choices[0].message?.content;
    if (!responseText) {
      throw new Error("Groq returned no content");
    }

    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse Groq response as JSON: ${parseError.message}`
      );
    }

    // Check if the LLM determined there's no recipe on this page
    if (extractedData.noRecipeFound === true) {
      const reason = extractedData.reason || "No recipe content found";
      console.log(`[LLM] No recipe found: ${reason}`);
      throw new Error(
        `No recipe found on this page. ${reason} Please make sure the link goes directly to a recipe, not a list of recipes.`
      );
    }

    if (!extractedData.title) {
      throw new Error("Extracted data missing required field: title");
    }

    extractedData.sourceUrl = sourceUrl;

    const totalLlmTime = Date.now() - llmStartTime;
    console.log(`[TIMING] Total social media LLM time: ${totalLlmTime}ms`);

    return extractedData;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      throw new Error(`Groq API error (${status}): ${JSON.stringify(data)}`);
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
 * Check if a URL is an Instagram URL
 */
function isInstagramUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("instagram.com") ||
      urlObj.hostname.includes("instagr.am")
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
  .runWith({ secrets: [OPENAI_API_KEY, GROQ_API_KEY] })
  .https.onCall(async (data: { url: string }, context) => {
    // Note: Authentication is optional - users can import recipes without logging in
    const timings: Record<string, number> = {};
    const totalStart = Date.now();

    // Validate input
    if (!data.url || typeof data.url !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "URL is required and must be a string"
      );
    }

    console.log(`[TIMING] Starting recipe extraction for: ${data.url}`);

    // Check if this is a Pinterest URL and extract the original URL
    let actualRecipeUrl = data.url;
    const isTikTok = isTikTokUrl(data.url);
    const isInstagram = isInstagramUrl(data.url);
    const isSocialMediaVideo = isTikTok || isInstagram;

    if (isPinterestUrl(data.url)) {
      const pinterestStart = Date.now();
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
      timings.pinterestExtraction = Date.now() - pinterestStart;
      console.log(
        `[TIMING] Pinterest extraction: ${timings.pinterestExtraction}ms`
      );
    }

    // TODO: CACHING DISABLED FOR PERFORMANCE
    // Cache check was taking ~400ms per request. Uncomment below to re-enable caching.
    // This would help if users frequently re-import the same recipe URL.
    /*
    // Normalize URL for caching (remove trailing slashes, fragments, etc.)
    const normalizedUrl = data.url.trim().replace(/\/$/, "").split("#")[0].split("?")[0];
    const CACHE_VERSION = "v2";
    const cacheKey = `recipe-cache-${CACHE_VERSION}-${Buffer.from(normalizedUrl).toString("base64").replace(/[+/=]/g, "")}`;

    if (!isSocialMediaVideo) {
      const cacheCheckStart = Date.now();
    try {
      const db = admin.firestore();
      const cacheRef = db.collection("recipeCache").doc(cacheKey);
      const cachedDoc = await cacheRef.get();
        timings.cacheCheck = Date.now() - cacheCheckStart;
        console.log(`[TIMING] Cache check: ${timings.cacheCheck}ms`);

      if (cachedDoc.exists) {
        const cachedData = cachedDoc.data();
        const cacheAge = Date.now() - cachedData!.cachedAt.toMillis();
          const cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (cacheAge < cacheExpiry) {
            console.log(`[TIMING] Cache HIT - returning cached recipe`);
          const cachedRecipe = cachedData!.recipe;
          if (isPinterestUrl(data.url) && actualRecipeUrl !== data.url) {
            cachedRecipe.sourceUrl = actualRecipeUrl;
          }
          return cachedRecipe;
        } else {
          await cacheRef.delete();
        }
      }
    } catch (cacheError: any) {
        console.warn("Cache check failed:", cacheError.message);
      }
    }
    */

    try {
      // Fetch HTML content from the actual recipe URL (not Pinterest)
      const fetchStart = Date.now();
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
      timings.httpFetch = Date.now() - fetchStart;
      console.log(
        `[TIMING] HTTP fetch: ${timings.httpFetch}ms (${(
          response.data.length / 1024
        ).toFixed(1)}KB)`
      );

      // Parse HTML with Cheerio
      const parseStart = Date.now();
      const $ = cheerio.load(response.data);
      timings.htmlParse = Date.now() - parseStart;
      console.log(`[TIMING] HTML parse (Cheerio): ${timings.htmlParse}ms`);

      // For TikTok/Instagram, get metadata and extract description from page
      let socialMediaDescription = "";
      let tiktokOEmbed: {
        title: string;
        author_name: string;
        thumbnail_url: string;
      } | null = null;

      if (isTikTok) {
        // Get metadata from TikTok oEmbed API
        const oembedStart = Date.now();
        tiktokOEmbed = await getTikTokOEmbed(actualRecipeUrl);
        timings.tiktokOembed = Date.now() - oembedStart;
        console.log(`[TIMING] TikTok oEmbed: ${timings.tiktokOembed}ms`);
        console.log("TikTok oEmbed data:", tiktokOEmbed);

        // Extract description from meta tags for recipe parsing
        socialMediaDescription =
          $('meta[property="og:description"]').attr("content") ||
          $('meta[name="description"]').attr("content") ||
          "";

        // Try to extract description from TikTok's JSON data in script tags
        if (!socialMediaDescription) {
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
                  socialMediaDescription =
                    jsonData.__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo
                      .itemStruct.desc;
                  break;
                }
              }

              // Look for description in any JSON structure
              const descPattern = /"desc"\s*:\s*"([^"]+)"/;
              const descMatch = scriptContent.match(descPattern);
              if (descMatch && !socialMediaDescription) {
                socialMediaDescription = descMatch[1]
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
          socialMediaDescription.substring(0, 200)
        );
      }

      if (isInstagram) {
        // Extract description from Instagram meta tags
        socialMediaDescription =
          $('meta[property="og:description"]').attr("content") ||
          $('meta[name="description"]').attr("content") ||
          "";

        // Try to extract from Instagram's JSON data in script tags
        if (!socialMediaDescription) {
          const scripts = $("script");
          for (let i = 0; i < scripts.length; i++) {
            const scriptContent = scripts.eq(i).html() || "";
            try {
              // Instagram stores data in various JSON structures
              const captionPatterns = [
                /"caption"\s*:\s*"([^"]+)"/,
                /"text"\s*:\s*"([^"]+)"/,
                /"edge_media_to_caption".*?"text"\s*:\s*"([^"]+)"/s,
              ];

              for (const pattern of captionPatterns) {
                const match = scriptContent.match(pattern);
                if (match && !socialMediaDescription) {
                  socialMediaDescription = match[1]
                    .replace(/\\n/g, "\n")
                    .replace(/\\"/g, '"')
                    .replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
                      String.fromCharCode(parseInt(m.slice(2), 16))
                    );
                  break;
                }
              }
              if (socialMediaDescription) break;
            } catch (e) {
              continue;
            }
          }
        }

        console.log(
          "Instagram extracted description:",
          socialMediaDescription.substring(0, 200)
        );
      }

      // Skip JSON-LD, DOM fallback, and recipe section extraction for social media
      // These platforms don't have structured recipe data - saves ~50-100ms
      type DomFallbackData = {
        author: string;
        prepTime: number | null;
        cookTime: number | null;
        totalTime: number | null;
      };
      let jsonLdData: ReturnType<typeof parseJSONLD> = null;
      let fallbackDomData: DomFallbackData | null = null;
      let recipeSectionHtml: string | null = null;

      if (!isSocialMediaVideo) {
        // IMPORTANT: Parse JSON-LD and recipe section BEFORE removing script tags!
        // JSON-LD data lives in <script type="application/ld+json"> tags
        const jsonLdStart = Date.now();
        jsonLdData = parseJSONLD($);
        timings.jsonLdParse = Date.now() - jsonLdStart;
        console.log(
          `[TIMING] JSON-LD parse: ${timings.jsonLdParse}ms (found: ${
            jsonLdData ? "yes" : "no"
          })`
        );

        // DOM fallback is now lazy - only extracted when JSON-LD is missing fields
        // See extractDomFallbackLazy() call below

        const recipeSectionStart = Date.now();
        recipeSectionHtml = extractRecipeSection($);
        timings.recipeSection = Date.now() - recipeSectionStart;
        console.log(
          `[TIMING] Recipe section extraction: ${
            timings.recipeSection
          }ms (found: ${
            recipeSectionHtml ? recipeSectionHtml.length + " chars" : "no"
          })`
        );
      } else {
        console.log(
          `[TIMING] Skipping JSON-LD/DOM/recipe section extraction for social media URL`
        );
      }

      // NOW remove script, style, and non-essential elements (after JSON-LD extraction)
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

      // Clean up HTML: remove excessive whitespace but preserve structure
      htmlContent = htmlContent
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();

      let extractedData: Omit<Recipe, "id" | "createdAt">;

      // 🚀 FAST PATH: For social media (TikTok/Instagram), use only the caption text
      // This dramatically reduces LLM input size and uses a faster model
      if (isSocialMediaVideo && socialMediaDescription) {
        console.log(
          `[TIMING] Using fast social media path - caption length: ${socialMediaDescription.length} chars`
        );

        const llmMainStart = Date.now();
        extractedData = await callLLMForSocialMedia(
          socialMediaDescription,
          actualRecipeUrl
        );
        timings.llmMain = Date.now() - llmMainStart;
        console.log(
          `[TIMING] Social media LLM call: ${timings.llmMain}ms`
        );
      } else if (jsonLdData) {
        // Check if we need DOM fallback for any missing fields
        const needsDomFallback =
          !jsonLdData.originalAuthor ||
          jsonLdData.prepTime === undefined ||
          jsonLdData.cookTime === undefined ||
          jsonLdData.totalTime === undefined;

        // Only extract DOM fallback if JSON-LD is missing fields we can supplement
        // This lazy approach saves ~20-50ms when JSON-LD has all fields
        if (needsDomFallback) {
          const domFallbackStart = Date.now();
          fallbackDomData = extractAuthorAndTimesFromDOM($);
          timings.domFallback = Date.now() - domFallbackStart;
          console.log(
            `[TIMING] DOM fallback extraction (lazy): ${timings.domFallback}ms`
          );
          console.log("DOM fallback data:", fallbackDomData);
        } else {
          console.log(
            `[TIMING] Skipping DOM fallback - JSON-LD has all fields`
          );
        }

        extractedData = {
          title: jsonLdData.title || "",
          coverImage: jsonLdData.coverImage || "",
          ingredients: jsonLdData.ingredients || [],
          steps: jsonLdData.steps || [],
          nutritionalInfo: jsonLdData.nutritionalInfo || {},
          sourceUrl: actualRecipeUrl,
          originalAuthor:
            jsonLdData.originalAuthor || fallbackDomData?.author || "Unknown",
          tags: jsonLdData.tags || [],
          categoryIds: jsonLdData.categoryIds || [],
          ...(jsonLdData.prepTime !== undefined
            ? { prepTime: jsonLdData.prepTime }
            : fallbackDomData?.prepTime !== undefined
            ? { prepTime: fallbackDomData.prepTime }
            : {}),

          ...(jsonLdData.cookTime !== undefined
            ? { cookTime: jsonLdData.cookTime }
            : fallbackDomData?.cookTime !== undefined
            ? { cookTime: fallbackDomData.cookTime }
            : {}),

          ...(jsonLdData.totalTime !== undefined
            ? { totalTime: jsonLdData.totalTime }
            : fallbackDomData?.totalTime !== undefined
            ? { totalTime: fallbackDomData.totalTime }
            : {}),
        };

        // 🔧 JSON-LD incomplete → supplement with AI
        // Check if steps are empty OR if steps exist but have no valid instructions
        const hasValidSteps =
          extractedData.steps.length > 0 &&
          extractedData.steps.some(
            (step) => step.instruction && step.instruction.trim().length > 0
          );

        if (!extractedData.ingredients.length || !hasValidSteps) {
          console.log("JSON-LD incomplete, supplementing with AI extraction");
          console.log(
            `Steps from JSON-LD: ${extractedData.steps.length}, Valid steps: ${hasValidSteps}`
          );

          // CRITICAL: Prioritize recipe section (#recipe div) before full HTML
          const aiHtml = recipeSectionHtml || htmlContent;
          if (recipeSectionHtml) {
            console.log(
              "Using extracted recipe section (#recipe div) to supplement JSON-LD"
            );
            console.log(
              `Recipe section length: ${recipeSectionHtml.length} characters`
            );
          } else {
            console.log(
              "WARNING: No recipe section found, using full HTML to supplement JSON-LD"
            );
          }
          const llmSupplementStart = Date.now();
          const aiData = await callLLM(aiHtml, actualRecipeUrl);
          timings.llmSupplement = Date.now() - llmSupplementStart;
          console.log(
            `[TIMING] LLM supplement call: ${timings.llmSupplement}ms`
          );

          // Combine duplicate ingredients (e.g., butter from "making the dough" and "making the frosting")
          const combinedIngredients = combineIngredients(
            extractedData.ingredients || []
          );

          extractedData = {
            ...extractedData,
            ingredients: extractedData.ingredients.length
              ? combinedIngredients
              : aiData.ingredients,
            // Use AI steps if JSON-LD steps are empty or invalid
            steps: hasValidSteps ? extractedData.steps : aiData.steps,
            nutritionalInfo: Object.keys(extractedData.nutritionalInfo).length
              ? extractedData.nutritionalInfo
              : aiData.nutritionalInfo,
            coverImage: extractedData.coverImage || aiData.coverImage,
            // Preserve cookTime and totalTime from extractedData (which may have come from fallbackDomData)
            ...(extractedData.cookTime !== undefined && {
              cookTime: extractedData.cookTime,
            }),
            ...(extractedData.totalTime !== undefined && {
              totalTime: extractedData.totalTime,
            }),
          };
        }
      } else {
        // ❌ No JSON-LD → prioritize recipe section, then full HTML
        console.log("No JSON-LD found");

        // CRITICAL: Always try recipe section first (#recipe div)
        const aiHtml = recipeSectionHtml || htmlContent;
        if (recipeSectionHtml) {
          console.log(
            "Using extracted recipe section (#recipe div or similar) for AI extraction"
          );
          console.log(
            `Recipe section length: ${recipeSectionHtml.length} characters`
          );
        } else {
          console.log(
            "WARNING: No recipe section found, falling back to full HTML"
          );
          console.log(`Full HTML length: ${htmlContent.length} characters`);
        }

        const llmMainStart = Date.now();
        extractedData = await callLLM(aiHtml, actualRecipeUrl);
        timings.llmMain = Date.now() - llmMainStart;
        console.log(`[TIMING] LLM main call: ${timings.llmMain}ms`);

        // For non-social-media sites without JSON-LD, try DOM fallback for cookTime/totalTime
        if (!isSocialMediaVideo && !fallbackDomData) {
          const domFallbackStart = Date.now();
          fallbackDomData = extractAuthorAndTimesFromDOM($);
          timings.domFallback = Date.now() - domFallbackStart;
          console.log(
            `[TIMING] DOM fallback extraction (no JSON-LD path): ${timings.domFallback}ms`
          );
        }

        // Add cookTime and totalTime from DOM fallback if available
        if (fallbackDomData?.cookTime !== undefined) {
          extractedData.cookTime = fallbackDomData.cookTime;
        }
        if (fallbackDomData?.totalTime !== undefined) {
          extractedData.totalTime = fallbackDomData.totalTime;
        }
      }

      // For TikTok, use oEmbed data for image and author, but prefer LLM-extracted title
      if (isTikTok && tiktokOEmbed) {
        // Only use oEmbed title as fallback if LLM didn't extract a good title
        // LLM is prompted to find the actual dish name from the full caption
        if (
          !extractedData.title ||
          extractedData.title === "TikTok Recipe Video"
        ) {
          extractedData.title = tiktokOEmbed.title || "TikTok Recipe Video";
        }
        extractedData.coverImage =
          tiktokOEmbed.thumbnail_url || extractedData.coverImage || "";
        extractedData.originalAuthor =
          tiktokOEmbed.author_name || extractedData.originalAuthor || "Unknown";
      }

      // Ensure video recipe tag for TikTok and Instagram
      if (isSocialMediaVideo && !extractedData.tags?.includes("video recipe")) {
        extractedData.tags = [...(extractedData.tags || []), "video recipe"];
      }

      // Calculate prep time if not provided
      let prepTime = extractedData.prepTime;
      if (!prepTime && extractedData.steps && extractedData.steps.length > 0) {
        // Estimate prep time based on steps (simple heuristic)
        prepTime = Math.max(5, extractedData.steps.length * 3);
      }

      // Combine duplicate ingredients (e.g., butter from "making the dough" and "making the frosting")
      const combinedIngredients = combineIngredients(
        extractedData.ingredients || []
      );

      // Normalize nutrition: if it's per serving and we have servings, convert to whole recipe
      let normalizedNutrition = extractedData.nutritionalInfo || {};
      const servings = extractedData.servings;
      const isPerServing = normalizedNutrition.isPerServing === true;

      if (isPerServing && servings && servings > 0) {
        // Convert per-serving nutrition to whole recipe
        const multiplier = servings;
        normalizedNutrition = {
          ...normalizedNutrition,
          calories: normalizedNutrition.calories
            ? Math.round(normalizedNutrition.calories * multiplier)
            : undefined,
          protein: normalizedNutrition.protein
            ? Math.round(normalizedNutrition.protein * multiplier * 10) / 10
            : undefined,
          carbohydrates: normalizedNutrition.carbohydrates
            ? Math.round(normalizedNutrition.carbohydrates * multiplier * 10) /
              10
            : undefined,
          fat: normalizedNutrition.fat
            ? Math.round(normalizedNutrition.fat * multiplier * 10) / 10
            : undefined,
          fiber: normalizedNutrition.fiber
            ? Math.round(normalizedNutrition.fiber * multiplier * 10) / 10
            : undefined,
          sugar: normalizedNutrition.sugar
            ? Math.round(normalizedNutrition.sugar * multiplier * 10) / 10
            : undefined,
          sodium: normalizedNutrition.sodium
            ? Math.round(normalizedNutrition.sodium * multiplier)
            : undefined,
          isPerServing: false, // Now normalized to whole recipe
        };
      } else if (isPerServing && (!servings || servings <= 0)) {
        // If marked as per serving but no serving count, try to infer from typical values
        // Very low calories (50-300) likely means per serving
        if (
          normalizedNutrition.calories &&
          normalizedNutrition.calories < 300
        ) {
          // Assume 4 servings as default if not specified
          const defaultServings = 4;
          normalizedNutrition = {
            ...normalizedNutrition,
            calories: Math.round(
              normalizedNutrition.calories * defaultServings
            ),
            protein: normalizedNutrition.protein
              ? Math.round(normalizedNutrition.protein * defaultServings * 10) /
                10
              : undefined,
            carbohydrates: normalizedNutrition.carbohydrates
              ? Math.round(
                  normalizedNutrition.carbohydrates * defaultServings * 10
                ) / 10
              : undefined,
            fat: normalizedNutrition.fat
              ? Math.round(normalizedNutrition.fat * defaultServings * 10) / 10
              : undefined,
            fiber: normalizedNutrition.fiber
              ? Math.round(normalizedNutrition.fiber * defaultServings * 10) /
                10
              : undefined,
            sugar: normalizedNutrition.sugar
              ? Math.round(normalizedNutrition.sugar * defaultServings * 10) /
                10
              : undefined,
            sodium: normalizedNutrition.sodium
              ? Math.round(normalizedNutrition.sodium * defaultServings)
              : undefined,
            isPerServing: false,
          };
        }
      }

      // Sanitize ingredients to ensure no undefined values (Firestore doesn't accept undefined)
      const sanitizedIngredients = combinedIngredients.map((ing) => ({
        name: ing.name || "",
        quantity: ing.quantity ?? 0,
        unit: ing.unit || "",
        isChecked: ing.isChecked ?? false,
      }));

      // Sanitize steps to ensure no undefined values
      const sanitizedSteps = (extractedData.steps || []).map((step: any) => ({
        id: step.id || `step-${Math.random().toString(36).substr(2, 9)}`,
        instruction: step.instruction || "",
        isCompleted: step.isCompleted ?? false,
        isBeginnerFriendly: step.isBeginnerFriendly ?? true,
        ...(step.timerDuration !== undefined &&
          step.timerDuration !== null && { timerDuration: step.timerDuration }),
        ...(step.title && { title: step.title }),
      }));

      // Sanitize nutrition to remove undefined values
      const sanitizedNutrition: Record<string, any> = {};
      Object.entries(normalizedNutrition).forEach(([key, value]) => {
        if (value !== undefined) {
          sanitizedNutrition[key] = value;
        }
      });

      const recipe: Omit<Recipe, "id" | "createdAt"> = {
        title: extractedData.title || "Untitled Recipe",
        coverImage: extractedData.coverImage || "",
        ingredients: sanitizedIngredients,
        steps: sanitizedSteps,
        nutritionalInfo: sanitizedNutrition,
        sourceUrl: actualRecipeUrl,
        originalAuthor: extractedData.originalAuthor || "Unknown",
        tags: extractedData.tags || [],
        categoryIds: extractedData.categoryIds || [],
        ...(prepTime !== undefined && { prepTime }),
        ...(extractedData.cookTime !== undefined && {
          cookTime: extractedData.cookTime,
        }),
        ...(extractedData.totalTime !== undefined && {
          totalTime: extractedData.totalTime,
        }),
        ...(servings !== undefined && servings !== null && { servings }),
      };

      // TODO: CACHING DISABLED FOR PERFORMANCE
      // Cache write was adding ~100-200ms. Uncomment below to re-enable caching.
      /*
      if (!isSocialMediaVideo) {
        const cacheWriteStart = Date.now();
      try {
        const db = admin.firestore();
        const cacheRef = db.collection("recipeCache").doc(cacheKey);
        await cacheRef.set({
          recipe,
          cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          url: normalizedUrl,
        });
          timings.cacheWrite = Date.now() - cacheWriteStart;
          console.log(`[TIMING] Cache write: ${timings.cacheWrite}ms`);
      } catch (cacheError: any) {
          console.warn("Failed to cache recipe:", cacheError.message);
        }
      }
      */

      // Final timing summary
      const totalTime = Date.now() - totalStart;
      console.log(`\n[TIMING] ===== FINAL SUMMARY =====`);
      console.log(
        `[TIMING] Total extraction time: ${totalTime}ms (${(
          totalTime / 1000
        ).toFixed(1)}s)`
      );
      console.log(`[TIMING] Breakdown:`);
      Object.entries(timings).forEach(([key, value]) => {
        const percent = ((value / totalTime) * 100).toFixed(1);
        console.log(`[TIMING]   ${key}: ${value}ms (${percent}%)`);
      });
      console.log(`[TIMING] =============================\n`);

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
  "calories": number (REQUIRED - always provide a number, estimate if needed),
  "protein": number (REQUIRED - in grams, always provide a number),
  "carbohydrates": number (REQUIRED - in grams, always provide a number),
  "fat": number (REQUIRED - in grams, always provide a number),
  "sugar": number (REQUIRED - in grams, always provide a number),
  "fiber": number (in grams, optional - can be null),
  "sodium": number (in milligrams, optional - can be null)
}

Rules:
- CRITICAL: calories, protein, carbohydrates, fat, and sugar are REQUIRED fields - you MUST always return a number for these, never null
- Calculate totals for the entire recipe based on all ingredients
- Use standard nutritional databases (USDA, etc.) for common ingredients
- Convert all units to grams/milligrams as needed
- Round to nearest whole number
- If an ingredient quantity is missing or unclear, estimate a typical amount (e.g., "salt" without quantity = 1/4 tsp)
- If an ingredient is ambiguous, make reasonable estimates based on common usage
- Include all ingredients in the calculation
- For optional fields (fiber, sodium), return null if you cannot determine them
- Even if ingredients are vague, ALWAYS estimate the 5 required nutrition values based on what the dish appears to be

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
        model: "gpt-4o-mini", // Using GPT-4o-mini for faster, cost-effective results
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

    // Ensure required fields are always numbers (never null/undefined)
    // This is critical for the client-side merge logic to work correctly
    const requiredFields = [
      "calories",
      "protein",
      "carbohydrates",
      "fat",
      "sugar",
    ];
    for (const field of requiredFields) {
      if (
        nutritionData[field] === null ||
        nutritionData[field] === undefined ||
        isNaN(nutritionData[field])
      ) {
        console.warn(
          `Nutrition field ${field} was ${nutritionData[field]}, defaulting to 0`
        );
        nutritionData[field] = 0;
      }
    }

    console.log("Generated nutrition data:", JSON.stringify(nutritionData));

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

/**
 * Prompt for extracting structured recipe data from OCR text
 */
const RECIPE_EXTRACTION_FROM_OCR_PROMPT = `You are an expert recipe data extraction assistant. Your task is to extract structured recipe information from OCR text extracted from a recipe photo or screenshot and output it as a JSON object.

IMPORTANT: You must output ONLY valid JSON that matches this exact TypeScript interface:

{
  "title": string,
  "coverImage": string (empty string "" for image imports),
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
    "title": string | null (optional title for instruction sections)
  }>,
  "nutritionalInfo": {
    "calories": number | null,
    "protein": number | null (in grams),
    "carbohydrates": number | null (in grams),
    "fat": number | null (in grams),
    "fiber": number | null (in grams),
    "sugar": number | null (in grams),
    "sodium": number | null (in milligrams),
    "isPerServing": boolean | null (true if nutrition is per serving, false if for whole recipe, null if unknown)
  },
  "sourceUrl": string (empty string "" for image imports),
  "originalAuthor": string,
  "tags": string[],
  "categoryIds": [] (always empty array),
  "prepTime": number | null (in minutes, optional - active prep time only),
  "servings": number | null (number of servings the recipe makes, e.g., 4, 6, 8)
}

EXTRACTION RULES:

1. TITLE:
   - Extract the main recipe title (usually at the top)
   - Clean up extra whitespace and formatting artifacts from OCR
   - If multiple titles exist, choose the most prominent one

2. COVER IMAGE:
   - Always use empty string "" for image imports

3. INGREDIENTS:
   - Locate the ingredient list section in the OCR text
   - Look for headings like "Ingredients", "Ingredients You'll Need", "For the [X]", or similar
   - Parse ingredient lists from various formats (do not round):
     * "2 cups flour" → { name: "flour", quantity: 2, unit: "cups" }
     * "1/2 tsp salt" → { name: "salt", quantity: 0.5, unit: "tsp" }
     * "1/4 cup butter" → { name: "butter", quantity: 0.25, unit: "cup" }
     * "1 egg" → { name: "egg", quantity: 1, unit: "egg" }
     * "3 large eggs" → { name: "eggs", quantity: 3, unit: "large" }
   - Handle OCR errors: common misreads like "O" for "0", "I" for "1", etc.
   - Handle fractions: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, etc.
   - Handle ranges: "2-3 cups" → use average or first value
   - Handle "to taste", "as needed", "optional" → quantity: null, unit: "to taste"
   - Clean ingredient names: remove quantities, units, and OCR artifacts
   - Always set isChecked to false

4. STEPS:
   - Find the instructions/steps section (usually below ingredients)
   - Look for numbered lists, bullet points, or paragraph-form instructions
   - Split instructions into individual steps if they're in paragraph form
   - Each step should be a complete, actionable instruction
   - Generate unique IDs: "step-1", "step-2", etc.
   - CRITICAL FORMATTING RULE: When an instruction mentions multiple ingredients (2 or more), format them as a bulleted list:
     * Example: "Combine butter, flour, and sugar" → "Combine:\n• butter\n• flour\n• sugar"
   - TIME INFORMATION IN INSTRUCTIONS:
     * Keep time information in the instruction text when it's part of the actual cooking instruction
     * Examples: "Bake for 20 minutes", "Simmer for 10 minutes"
   - Determine isBeginnerFriendly:
     * true: Simple actions like "mix", "stir", "bake at 350°F"
     * false: Complex techniques like "temper", "braise", "sous vide"
   - Extract timerDuration from text:
     * "bake for 20 minutes" → 1200 seconds
     * "simmer 5 min" → 300 seconds
     * "cook until golden" → null
   - Always set isCompleted to false

5. NUTRITIONAL INFO:
   - Extract from nutrition facts tables or text if present
   - Look for patterns: "Calories: 250", "Protein 10g", etc.
   - Convert units: ensure protein/carbs/fat in grams, sodium in mg
   - CRITICAL: Check if nutrition is labeled as "per serving", "per portion", "per slice", or similar
   - If nutrition table/header says "per serving" or "Nutrition per serving" or similar, set isPerServing: true
   - If nutrition is clearly for the whole recipe (e.g., "Total Nutrition", "Recipe Nutrition"), set isPerServing: false
   - If unclear, check if values seem reasonable: very low calories (50-300) might indicate per serving, while high values (500+) might be whole recipe
   - If not found, set to null (not 0)

6. SOURCE URL:
   - Always use empty string "" for image imports

7. ORIGINAL AUTHOR:
   - Extract from text if present (e.g., "By [Name]")
   - If not found, use "Imported from photo"

8. TAGS:
   - Generate relevant tags from recipe content:
     * Recipe type: "dessert", "main-course", "appetizer", "breakfast"
     * Cuisine: "italian", "mexican", "asian", etc.
     * Dietary: "vegetarian", "vegan", "gluten-free", "keto"
     * Cooking method: "baked", "grilled", "slow-cooked"
   - Minimum 2-3 tags, maximum 8 tags
   - Always include "imported from photo" tag

9. CATEGORY IDS:
   - Always use empty array []

10. PREP TIME:
   - Extract prep time (active preparation time) in minutes if explicitly stated
   - If NOT explicitly stated, estimate based on instructions:
     * Analyze all steps and count only active prep work (chopping, mixing, measuring, etc.)
     * Exclude passive steps (waiting, resting, marinating, baking, cooking)
     * Estimate time per active prep step: 2-10 min each
   - Always provide a prep time estimate - never return null unless zero active prep
   - Return value in minutes

HANDLING OCR ERRORS:
- OCR text may have character recognition errors (e.g., "O" for "0", "rn" for "m")
- Use context to correct common OCR mistakes
- If data is ambiguous, make reasonable inferences
- If critical data is missing, use sensible defaults (empty arrays, null values)
- Preserve original meaning even if formatting is inconsistent

HANDWRITING DETECTION:
Before extracting the recipe, analyze the OCR text to determine if it appears to be handwritten.
- Look for characteristics of handwriting: inconsistent letter shapes, variable spacing, cursive script, personal notes
- Compare against typed/printed text: consistent fonts, uniform spacing, professional formatting
- If the text appears to be handwritten, set "hasHandwriting": true
- If the text appears to be typed/printed text, set "hasHandwriting": false

OUTPUT FORMAT:
Return ONLY the JSON object, no markdown, no code blocks, no explanations. The JSON must be valid and parseable.

The JSON object must include an additional field:
{
  ... (all recipe fields above),
  "hasHandwriting": boolean (true if the image contains handwritten text, false if typed/printed)
}

OCR text content:
`;

/**
 * Preprocess image: resize and auto-rotate
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Get image metadata to check orientation
    const metadata = await sharp(imageBuffer).metadata();

    // Auto-rotate based on EXIF orientation and resize if needed
    let processed = sharp(imageBuffer).rotate(); // Auto-rotate based on EXIF

    // Resize if too large (max 2000px on longest side for better OCR)
    if (metadata.width && metadata.height) {
      const maxDimension = 2000;
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        processed = processed.resize(maxDimension, maxDimension, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }
    }

    // Convert to JPEG for consistency
    return await processed.jpeg({ quality: 90 }).toBuffer();
  } catch (error: any) {
    console.error("Error preprocessing image:", error);
    // Return original if preprocessing fails
    return imageBuffer;
  }
}

/**
 * Extract text from image using Google Cloud Vision OCR
 */
async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    // Initialize Vision client
    const client = new ImageAnnotatorClient();

    // Perform OCR with optimized settings for printed text
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      throw new Error("No text detected in image");
    }

    // The first detection contains the full text
    const fullText = detections[0].description || "";

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No text content extracted from image");
    }

    return fullText;
  } catch (error: any) {
    console.error("Error extracting text from image:", error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Extract recipe from OCR text using OpenAI
 */
async function extractRecipeFromOCRText(
  ocrText: string
): Promise<Omit<Recipe, "id" | "createdAt"> & { hasHandwriting?: boolean }> {
  const prompt = RECIPE_EXTRACTION_FROM_OCR_PROMPT + ocrText;

  // Access API key from secret
  const apiKeyRaw = OPENAI_API_KEY.value();

  if (!apiKeyRaw) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please set it using:\n" +
        "firebase functions:secrets:set OPENAI_API_KEY"
    );
  }

  // Clean the API key
  const apiKey = apiKeyRaw.trim().replace(/\s+/g, "");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini", // Using GPT-4o-mini for cost-effective results
        messages: [
          {
            role: "system",
            content:
              "You are a recipe data extraction assistant. Extract structured recipe information from OCR text and return ONLY valid JSON matching the required schema.",
          },
          {
            role: "user",
            content: prompt,
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

    let recipeData: any;

    try {
      recipeData = JSON.parse(responseText);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse OpenAI response as JSON: ${
          parseError.message
        }. Response: ${responseText.substring(0, 200)}`
      );
    }

    // Validate and set defaults
    const hasHandwriting = recipeData.hasHandwriting === true;

    // Normalize nutrition: if it's per serving and we have servings, convert to whole recipe
    let normalizedNutrition = recipeData.nutritionalInfo || {};
    const servings = recipeData.servings;
    const isPerServing = normalizedNutrition.isPerServing === true;

    if (isPerServing && servings && servings > 0) {
      // Convert per-serving nutrition to whole recipe
      const multiplier = servings;
      normalizedNutrition = {
        ...normalizedNutrition,
        calories: normalizedNutrition.calories
          ? Math.round(normalizedNutrition.calories * multiplier)
          : undefined,
        protein: normalizedNutrition.protein
          ? Math.round(normalizedNutrition.protein * multiplier * 10) / 10
          : undefined,
        carbohydrates: normalizedNutrition.carbohydrates
          ? Math.round(normalizedNutrition.carbohydrates * multiplier * 10) / 10
          : undefined,
        fat: normalizedNutrition.fat
          ? Math.round(normalizedNutrition.fat * multiplier * 10) / 10
          : undefined,
        fiber: normalizedNutrition.fiber
          ? Math.round(normalizedNutrition.fiber * multiplier * 10) / 10
          : undefined,
        sugar: normalizedNutrition.sugar
          ? Math.round(normalizedNutrition.sugar * multiplier * 10) / 10
          : undefined,
        sodium: normalizedNutrition.sodium
          ? Math.round(normalizedNutrition.sodium * multiplier)
          : undefined,
        isPerServing: false, // Now normalized to whole recipe
      };
    } else if (isPerServing && (!servings || servings <= 0)) {
      // If marked as per serving but no serving count, try to infer from typical values
      if (normalizedNutrition.calories && normalizedNutrition.calories < 300) {
        // Assume 4 servings as default if not specified
        const defaultServings = 4;
        normalizedNutrition = {
          ...normalizedNutrition,
          calories: Math.round(normalizedNutrition.calories * defaultServings),
          protein: normalizedNutrition.protein
            ? Math.round(normalizedNutrition.protein * defaultServings * 10) /
              10
            : undefined,
          carbohydrates: normalizedNutrition.carbohydrates
            ? Math.round(
                normalizedNutrition.carbohydrates * defaultServings * 10
              ) / 10
            : undefined,
          fat: normalizedNutrition.fat
            ? Math.round(normalizedNutrition.fat * defaultServings * 10) / 10
            : undefined,
          fiber: normalizedNutrition.fiber
            ? Math.round(normalizedNutrition.fiber * defaultServings * 10) / 10
            : undefined,
          sugar: normalizedNutrition.sugar
            ? Math.round(normalizedNutrition.sugar * defaultServings * 10) / 10
            : undefined,
          sodium: normalizedNutrition.sodium
            ? Math.round(normalizedNutrition.sodium * defaultServings)
            : undefined,
          isPerServing: false,
        };
      }
    }

    return {
      title: recipeData.title || "Imported Recipe",
      coverImage: recipeData.coverImage || "", // Preserve coverImage if provided, otherwise empty
      ingredients: Array.isArray(recipeData.ingredients)
        ? recipeData.ingredients
        : [],
      steps: Array.isArray(recipeData.steps) ? recipeData.steps : [],
      nutritionalInfo: normalizedNutrition,
      sourceUrl: "", // Empty for image imports
      originalAuthor: recipeData.originalAuthor || "Imported from photo",
      tags: Array.isArray(recipeData.tags)
        ? [...recipeData.tags, "imported from photo"]
        : ["imported from photo"],
      categoryIds: [],
      prepTime: recipeData.prepTime || null,
      cookTime: recipeData.cookTime || null,
      totalTime: recipeData.totalTime || null,
      ...(servings !== undefined && servings !== null && { servings }),
      hasHandwriting, // Include handwriting detection result
    };
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
 * Extract recipe from image using OCR and AI
 */
export const extractRecipeFromImage = functions
  .region("us-central1")
  .runWith({
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300, // 5 minutes for image processing
    memory: "1GB", // More memory for image processing
  })
  .https.onCall(async (data: { imageBase64: string }, context) => {
    // Note: Authentication is optional - users can import recipes without logging in

    // Validate input
    if (!data.imageBase64 || typeof data.imageBase64 !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "imageBase64 is required and must be a string"
      );
    }

    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(data.imageBase64, "base64");

      // Preprocess image: resize and auto-rotate
      console.log("Preprocessing image...");
      const processedImage = await preprocessImage(imageBuffer);

      // Extract text using OCR
      console.log("Running OCR...");
      const ocrText = await extractTextFromImage(processedImage);

      if (!ocrText || ocrText.trim().length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "No text detected in image. Please ensure the image contains typed text."
        );
      }

      console.log(`OCR extracted ${ocrText.length} characters`);

      // Extract structured recipe data from OCR text using OpenAI
      console.log("Extracting recipe data from OCR text...");
      const recipeResult = await extractRecipeFromOCRText(ocrText);

      // Extract hasHandwriting and remove it from recipe data
      const { hasHandwriting, ...recipe } = recipeResult;

      // Return recipe with handwriting flag
      return {
        ...recipe,
        hasHandwriting: hasHandwriting || false,
      };
    } catch (error: any) {
      console.error("Error extracting recipe from image:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        `Failed to extract recipe from image: ${error.message}`
      );
    }
  });

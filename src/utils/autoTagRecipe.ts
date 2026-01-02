import { NutritionalInfo, RecipeCreateInput } from "../types";

// Filter categories from FilterModal
const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "appetizer",
  "dessert",
  "brunch",
];

const CUISINES = [
  "italian",
  "mexican",
  "japanese",
  "french",
  "thai",
  "indian",
  "greek",
  "chinese",
  "american",
  "mediterranean",
  "korean",
  "spanish",
  "vietnamese",
  "middle-eastern",
];

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "keto",
  "paleo",
  "low-carb",
  "nut-free",
  "sugar-free",
];

/**
 * Detects source type from URL
 */
function detectSourceType(url: string): string | null {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("tiktok.com") || lowerUrl.includes("vm.tiktok")) {
    return "tiktok";
  }
  if (lowerUrl.includes("instagram.com") || lowerUrl.includes("instagr.am")) {
    return "instagram";
  }
  if (lowerUrl.includes("pinterest.com") || lowerUrl.includes("pin.it")) {
    return "pinterest";
  }
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
    return "youtube";
  }
  if (
    lowerUrl.includes("blog") ||
    lowerUrl.includes("wordpress") ||
    lowerUrl.includes("blogspot") ||
    lowerUrl.includes("medium.com")
  ) {
    return "blog";
  }

  return "website";
}

/**
 * Checks if text contains keywords for a meal type
 */
function matchesMealType(text: string, mealType: string): boolean {
  const lowerText = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    breakfast: [
      "breakfast",
      "morning",
      "pancake",
      "waffle",
      "cereal",
      "oatmeal",
      "eggs",
      "toast",
    ],
    lunch: ["lunch", "sandwich", "salad", "wrap", "soup"],
    dinner: ["dinner", "supper", "main course", "entree"],
    snack: ["snack", "trail mix", "chips", "crackers"],
    appetizer: [
      "appetizer",
      "appetiser",
      "starter",
      "hors d'oeuvre",
      "finger food",
    ],
    dessert: [
      "dessert",
      "sweet",
      "cake",
      "cookie",
      "pie",
      "ice cream",
      "pudding",
      "candy",
    ],
    brunch: ["brunch"],
  };

  const typeKeywords = keywords[mealType] || [];
  return typeKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Checks if text contains keywords for a cuisine
 */
function matchesCuisine(text: string, cuisine: string): boolean {
  const lowerText = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    italian: [
      "italian",
      "pasta",
      "pizza",
      "risotto",
      "parmesan",
      "mozzarella",
      "basil",
      "oregano",
    ],
    mexican: [
      "mexican",
      "taco",
      "burrito",
      "quesadilla",
      "salsa",
      "guacamole",
      "cilantro",
      "jalapeño",
    ],
    japanese: [
      "japanese",
      "sushi",
      "ramen",
      "teriyaki",
      "miso",
      "wasabi",
      "soy sauce",
      "sake",
    ],
    french: [
      "french",
      "brie",
      "baguette",
      "croissant",
      "ratatouille",
      "bouillabaisse",
    ],
    thai: [
      "thai",
      "curry",
      "pad thai",
      "coconut milk",
      "lemongrass",
      "fish sauce",
    ],
    indian: [
      "indian",
      "curry",
      "tandoori",
      "naan",
      "masala",
      "turmeric",
      "cumin",
      "garam masala",
    ],
    greek: ["greek", "feta", "tzatziki", "hummus", "olive", "oregano"],
    chinese: [
      "chinese",
      "stir fry",
      "wonton",
      "dumpling",
      "soy sauce",
      "ginger",
      "sesame",
    ],
    american: [
      "american",
      "burger",
      "hot dog",
      "bbq",
      "barbecue",
      "mac and cheese",
    ],
    mediterranean: [
      "mediterranean",
      "olive oil",
      "hummus",
      "falafel",
      "tabbouleh",
    ],
    korean: ["korean", "kimchi", "bulgogi", "gochujang", "sesame oil"],
    spanish: ["spanish", "paella", "tapas", "saffron", "chorizo"],
    vietnamese: ["vietnamese", "pho", "banh mi", "fish sauce", "lemongrass"],
    "middle-eastern": [
      "middle eastern",
      "middle-eastern",
      "hummus",
      "falafel",
      "tahini",
      "za'atar",
    ],
  };

  const cuisineKeywords = keywords[cuisine] || [];
  return cuisineKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Checks if ingredients/steps indicate dietary restrictions
 */
function matchesDietary(
  ingredients: string[],
  steps: string[],
  dietary: string
): boolean {
  const allText = [...ingredients, ...steps].join(" ").toLowerCase();

  const restrictedKeywords: Record<string, string[]> = {
    vegetarian: [
      "meat",
      "chicken",
      "beef",
      "pork",
      "fish",
      "seafood",
      "bacon",
      "sausage",
      "ham",
    ],
    vegan: [
      "meat",
      "chicken",
      "beef",
      "pork",
      "fish",
      "seafood",
      "dairy",
      "milk",
      "cheese",
      "butter",
      "egg",
      "eggs",
      "honey",
      "yogurt",
      "cream",
    ],
    "gluten-free": [
      "flour",
      "wheat",
      "bread",
      "pasta",
      "gluten",
      "barley",
      "rye",
    ],
    "dairy-free": [
      "milk",
      "cheese",
      "butter",
      "cream",
      "yogurt",
      "dairy",
      "sour cream",
    ],
    keto: ["bread", "pasta", "rice", "potato", "potatoes", "flour", "sugar"],
    paleo: ["grain", "legume", "dairy", "processed", "flour", "bread"],
    "low-carb": ["bread", "pasta", "rice", "potato", "potatoes", "flour"],
    "nut-free": [
      "peanut",
      "almond",
      "walnut",
      "cashew",
      "nut",
      "nuts",
      "pecan",
      "hazelnut",
    ],
    "sugar-free": ["sugar", "honey", "syrup", "sweetener", "maple syrup"],
  };

  const restricted = restrictedKeywords[dietary] || [];

  // For vegetarian/vegan/restriction-based diets, check if ingredients DON'T contain restricted items
  // If we find restricted keywords, the recipe doesn't match the dietary restriction
  const hasRestricted = restricted.some((keyword) => allText.includes(keyword));
  return !hasRestricted;
}

/**
 * Checks if recipe is a one pot meal
 */
function isOnePotMeal(title: string): boolean {
  const allText = title.toLowerCase();

  const onePotKeywords = [
    "one pot",
    "one-pot",
    "one pan",
    "one-pan",
    "single pot",
    "single pan",
    "one dish meal",
    "all in one",
  ];

  if (onePotKeywords.some((keyword) => allText.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Checks nutritional info for nutritional tags
 */
function getNutritionalTags(nutrition: NutritionalInfo): string[] {
  const tags: string[] = [];

  if (nutrition.fat !== undefined && nutrition.fat <= 3) {
    tags.push("low-fat");
  }

  if (nutrition.protein !== undefined && nutrition.protein >= 10) {
    tags.push("high-protein");
  }

  if (nutrition.fiber !== undefined && nutrition.fiber >= 3) {
    tags.push("high-fiber");
  }

  if (nutrition.sodium !== undefined && nutrition.sodium <= 140) {
    tags.push("low-sodium");
  }

  if (nutrition.sugar !== undefined && nutrition.sugar <= 5) {
    tags.push("low-sugar");
  }

  if (nutrition.calories !== undefined && nutrition.calories <= 200) {
    tags.push("low-calorie");
  }

  return tags;
}

/**
 * Automatically generates tags for a recipe based on its content
 */
export function autoTagRecipe(recipe: RecipeCreateInput): string[] {
  const tags = new Set<string>(recipe.tags || []);

  // Combine all text content for analysis
  const title = recipe.title || "";
  const ingredients =
    recipe.ingredients?.map((ing) => ing.name).join(" ") || "";
  const steps = recipe.steps?.map((step) => step.instruction).join(" ") || "";
  const allText = `${title} ${ingredients} ${steps}`.toLowerCase();

  // Detect meal types
  for (const mealType of MEAL_TYPES) {
    if (matchesMealType(allText, mealType)) {
      tags.add(mealType);
    }
  }

  // Detect cuisines
  for (const cuisine of CUISINES) {
    if (matchesCuisine(allText, cuisine)) {
      tags.add(cuisine);
    }
  }

  // Detect dietary restrictions
  const ingredientNames = recipe.ingredients?.map((ing) => ing.name) || [];
  const stepInstructions = recipe.steps?.map((step) => step.instruction) || [];

  for (const dietary of DIETARY_OPTIONS) {
    if (matchesDietary(ingredientNames, stepInstructions, dietary)) {
      tags.add(dietary);
    }
  }

  // Detect source type
  if (recipe.sourceUrl) {
    const sourceType = detectSourceType(recipe.sourceUrl);
    if (sourceType) {
      tags.add(sourceType);
    }
  }

  // Add nutritional tags
  if (recipe.nutritionalInfo) {
    const nutritionalTags = getNutritionalTags(recipe.nutritionalInfo);
    nutritionalTags.forEach((tag) => tags.add(tag));
  }

  // Detect one pot meals
  if (isOnePotMeal(title)) {
    tags.add("one pot meal");
  }

  return Array.from(tags);
}

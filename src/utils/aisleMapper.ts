/**
 * Maps ingredient names to grocery store aisles
 */

export type Aisle =
  | "Produce"
  | "Dairy"
  | "Meat & Seafood"
  | "Bakery"
  | "Frozen"
  | "Baking"
  | "Pantry"
  | "Beverages"
  | "Snacks"
  | "Other";

export const AISLE_ORDER: Aisle[] = [
  "Produce",
  "Meat & Seafood",
  "Dairy",
  "Baking",
  "Bakery",
  "Frozen",
  "Pantry",
  "Beverages",
  "Snacks",
  "Other",
];

// Keywords per aisle with context for ambiguous items
const AISLE_KEYWORDS: Record<Aisle, string[]> = {
  Produce: [
    "apple",
    "banana",
    "orange",
    "lettuce",
    "tomato",
    "onion",
    "garlic",
    "bell pepper",
    "red pepper",
    "green pepper",
    "yellow pepper",
    "orange pepper",
    "jalapeño",
    "habanero",
    "carrot",
    "celery",
    "potato",
    "spinach",
    "mushroom",
    "herb",
    "basil",
    "parsley",
    "cilantro",
    "lemon",
    "lime",
    "avocado",
    "cucumber",
    "zucchini",
    "broccoli",
    "cauliflower",
  ],
  "Meat & Seafood": [
    "chicken",
    "beef",
    "pork",
    "turkey",
    "lamb",
    "fish",
    "salmon",
    "tuna",
    "shrimp",
    "crab",
    "lobster",
    "bacon",
    "sausage",
    "ham",
  ],
  Dairy: [
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "sour cream",
    "cottage cheese",
    "egg",
    "mozzarella",
    "cheddar",
    "parmesan",
  ],
  Bakery: ["bread", "bagel", "croissant", "roll", "bun", "tortilla", "pita"],
  Frozen: ["frozen", "ice cream", "frozen vegetable", "frozen fruit"],
  Baking: [
    "flour",
    "sugar",
    "salt",
    "peppercorn",
    "pepper",
    "chili powder",
    "spice",
    "oil",
    "vinegar",
    "seed",
    "honey",
    "syrup",
    "baking",
    "vanilla",
    "cocoa",
    "chocolate",
    "chocolate chip",
    "baking powder",
    "baking soda",
    "yeast",
    "cinnamon",
    "nutmeg",
  ],
  Pantry: [
    "pasta",
    "spaghetti",
    "penne",
    "macaroni",
    "noodle",
    "rice",
    "quinoa",
    "barley",
    "oats",
    "oatmeal",
    "bean",
    "lentil",
    "chickpea",
    "black bean",
    "kidney bean",
    "canned",
    "broth",
    "stock",
    "marinara",
    "pasta sauce",
    "tomato sauce",
    "crushed tomato",
    "diced tomato",
    "coconut milk",
    "coconut cream",
  ],
  Beverages: ["juice", "soda", "water", "coffee", "tea", "wine", "beer"],
  Snacks: ["chip", "cracker", "cookie", "pretzel", "popcorn"],
  Other: [], // fallback
};

/**
 * Returns the aisle for a given ingredient
 */
export function getAisleForIngredient(ingredientName: string): Aisle {
  const name = ingredientName.toLowerCase().trim();

  for (const aisle of AISLE_ORDER) {
    const keywords = AISLE_KEYWORDS[aisle];
    // Check if the ingredient name includes any of the keywords
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return aisle;
      }
    }
  }

  return "Other";
}

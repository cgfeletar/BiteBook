import { Ingredient } from "@/src/types";
import { formatQuantity } from "@/src/utils/fractionFormatter";

export const HEADER_HEIGHT = 300;
export const MIN_HEADER_HEIGHT = 100;

export const DAILY_VALUES = {
  calories: 2000,
  protein: 50,
  carbohydrates: 300,
  fat: 65,
  sugar: 50,
  fiber: 25,
};

const KITCHENWARE_KEYWORDS: Record<string, string> = {
  // Mixing & Blending
  "stand mixer": "Stand Mixer",
  "hand mixer": "Hand Mixer",
  "electric mixer": "Electric Mixer",
  mixer: "Mixer",
  blender: "Blender",
  "immersion blender": "Immersion Blender",
  "food processor": "Food Processor",
  whisk: "Whisk",
  "rubber spatula": "Rubber Spatula",
  spatula: "Spatula",
  "wooden spoon": "Wooden Spoon",
  "mixing bowl": "Mixing Bowl",
  "large bowl": "Large Bowl",
  "medium bowl": "Medium Bowl",
  "small bowl": "Small Bowl",
  bowl: "Bowl",
  // Measuring
  "measuring cup": "Measuring Cups",
  "measuring cups": "Measuring Cups",
  "measuring spoon": "Measuring Spoons",
  "measuring spoons": "Measuring Spoons",
  "liquid measuring cup": "Liquid Measuring Cup",
  "dry measuring cup": "Dry Measuring Cups",
  "kitchen scale": "Kitchen Scale",
  scale: "Kitchen Scale",
  // Baking
  "baking sheet": "Baking Sheet",
  "sheet pan": "Baking Sheet",
  "parchment paper": "Parchment Paper",
  "baking dish": "Baking Dish",
  "cake pan": "Cake Pan",
  "muffin tin": "Muffin Tin",
  "loaf pan": "Loaf Pan",
  "pie dish": "Pie Dish",
  "springform pan": "Springform Pan",
  "bundt pan": "Bundt Pan",
  "rolling pin": "Rolling Pin",
  "pastry brush": "Pastry Brush",
  // Cooking
  "frying pan": "Frying Pan",
  skillet: "Skillet",
  saucepan: "Saucepan",
  pot: "Pot",
  "large pot": "Large Pot",
  "dutch oven": "Dutch Oven",
  stockpot: "Stockpot",
  wok: "Wok",
  griddle: "Griddle",
  "cast iron": "Cast Iron Skillet",
  "non-stick pan": "Non-Stick Pan",
  // Cutting & Prep
  "cutting board": "Cutting Board",
  "chef's knife": "Chef's Knife",
  "paring knife": "Paring Knife",
  "serrated knife": "Serrated Knife",
  "kitchen shears": "Kitchen Shears",
  peeler: "Vegetable Peeler",
  grater: "Grater",
  zester: "Zester",
  microplane: "Microplane",
  mandoline: "Mandoline",
  // Other Tools
  "can opener": "Can Opener",
  "bottle opener": "Bottle Opener",
  corkscrew: "Corkscrew",
  tongs: "Tongs",
  "slotted spoon": "Slotted Spoon",
  ladle: "Ladle",
  strainer: "Strainer",
  colander: "Colander",
  sieve: "Sieve",
  "fine mesh strainer": "Fine Mesh Strainer",
  "aluminum foil": "Aluminum Foil",
  "plastic wrap": "Plastic Wrap",
  "ziploc bag": "Ziploc Bag",
  parchment: "Parchment Paper",
  "wax paper": "Wax Paper",
  // Appliances
  "slow cooker": "Slow Cooker",
  "crock pot": "Slow Cooker",
  "instant pot": "Instant Pot",
  "pressure cooker": "Pressure Cooker",
  "air fryer": "Air Fryer",
  "rice cooker": "Rice Cooker",
  "toaster oven": "Toaster Oven",
  "food thermometer": "Food Thermometer",
  "meat thermometer": "Meat Thermometer",
};

const KITCHENWARE_GROUPS: { label: string; matches: string[] }[] = [
  {
    label: "Mixing Bowls",
    matches: [
      "Bowl",
      "Large Bowl",
      "Medium Bowl",
      "Small Bowl",
      "Mixing Bowl",
    ],
  },
  {
    label: "Electronic Mixer",
    matches: ["Stand Mixer", "Hand Mixer", "Mixer", "Electric Mixer"],
  },
];

export function detectKitchenware(
  ingredients: Ingredient[],
  steps: { instruction: string }[]
): string[] {
  const kitchenwareSet = new Set<string>();

  const allText = [
    ...ingredients.map((ing) => ing.name),
    ...steps.map((step) => step.instruction),
  ]
    .join(" ")
    .toLowerCase();

  for (const [keyword, displayName] of Object.entries(KITCHENWARE_KEYWORDS)) {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(allText)) {
      kitchenwareSet.add(displayName);
    }
  }

  if (ingredients.length > 0) {
    const hasVolumeUnits = ingredients.some(
      (ing) =>
        ing.unit &&
        (ing.unit.toLowerCase().includes("cup") ||
          ing.unit.toLowerCase().includes("tablespoon") ||
          ing.unit.toLowerCase().includes("teaspoon") ||
          ing.unit.toLowerCase().includes("tbsp") ||
          ing.unit.toLowerCase().includes("tsp"))
    );

    if (hasVolumeUnits) {
      kitchenwareSet.add("Measuring Cups");
      kitchenwareSet.add("Measuring Spoons");
    }

    if (ingredients.length > 2) {
      kitchenwareSet.add("Mixing Bowl");
    }
  }

  // Combine/normalize groups
  const finalSet = new Set<string>(kitchenwareSet);
  for (const group of KITCHENWARE_GROUPS) {
    const hasAny = group.matches.some((item) => finalSet.has(item));
    if (hasAny) {
      group.matches.forEach((item) => finalSet.delete(item));
      finalSet.add(group.label);
    }
  }

  return Array.from(finalSet).sort();
}

export function combineIngredients(ingredients: Ingredient[]): Ingredient[] {
  const ingredientMap = new Map<string, Ingredient>();

  ingredients.forEach((ing) => {
    const unitKey = ing.unit ? ing.unit.toLowerCase().trim() : "";
    const key = `${ing.name.toLowerCase().trim()}|${unitKey}`;

    if (ingredientMap.has(key)) {
      const existing = ingredientMap.get(key)!;
      const existingQty = existing.quantity ?? 0;
      const ingQty = ing.quantity ?? 0;
      ingredientMap.set(key, {
        ...existing,
        quantity: existingQty + ingQty,
      });
    } else {
      ingredientMap.set(key, { ...ing });
    }
  });

  return Array.from(ingredientMap.values());
}

export function parseTimeFromInstruction(instruction: string): number | null {
  if (!instruction) return null;

  const timePatterns = [
    /for\s+(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|hours?|hrs?|hr|seconds?|secs?|sec)/i,
    /(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|hours?|hrs?|hr|seconds?|secs?|sec)/i,
  ];

  for (const pattern of timePatterns) {
    const match = instruction.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (isNaN(value) || value <= 0) continue;

      if (unit.includes("hour") || unit.includes("hr")) {
        return Math.round(value * 3600);
      } else if (unit.includes("minute") || unit.includes("min")) {
        return Math.round(value * 60);
      } else if (unit.includes("second") || unit.includes("sec")) {
        return Math.round(value);
      }
    }
  }

  return null;
}

export function enrichInstructionWithAmounts(
  instruction: string,
  ingredients: Ingredient[]
): string {
  if (!ingredients || ingredients.length === 0) return instruction;

  let enrichedText = instruction;

  const sortedIngredients = [...ingredients].sort(
    (a, b) => b.name.length - a.name.length
  );

  const replacements: Array<{
    start: number;
    end: number;
    replacement: string;
  }> = [];

  sortedIngredients.forEach((ing) => {
    const ingredientName = ing.name;
    const normalizedName = ingredientName.toLowerCase().trim();
    const mainPart = ingredientName.split(/[,\(]/)[0].trim();
    const normalizedMainPart = mainPart.toLowerCase().trim();

    const escapedName = ingredientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedNormalizedName = normalizedName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const escapedMainPart = mainPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedNormalizedMainPart = normalizedMainPart.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const pattern = new RegExp(
      `\\b(${escapedName}|${escapedNormalizedName}|${escapedMainPart}|${escapedNormalizedMainPart})\\b`,
      "gi"
    );

    let match;
    while ((match = pattern.exec(instruction)) !== null) {
      const offset = match.index;
      const matchText = match[0];
      const ingredientTextToUse = matchText;

      const lookbackStart = Math.max(0, offset - 50);
      const lookbackText = instruction.substring(lookbackStart, offset);

      const quantityPattern =
        /(\d+\s*\/\s*\d+|\d+\s+\.\s*\d+|\d+\.\d+|\d+)\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|g|gram|grams|oz|ounce|ounces|lb|pound|pounds|ml|milliliter|milliliters|l|liter|liters|stick|sticks|piece|pieces|whole|clove|cloves|head|heads|bunch|bunches|can|cans|package|packages|container|containers|of|egg|eggs|large|medium|small)\s*/i;

      const quantityMatch = lookbackText.match(quantityPattern);
      const hasQuantityBefore = quantityMatch !== null;

      if (ing.unit === "to taste" && ing.quantity === null) {
        const contextStart = Math.max(0, offset - 30);
        const contextEnd = Math.min(
          instruction.length,
          offset + matchText.length + 30
        );
        const context = instruction.substring(contextStart, contextEnd);
        const toTastePattern = /to\s+taste/i;
        const hasToTasteNearby = toTastePattern.test(context);

        if (!hasToTasteNearby) {
          replacements.push({
            start: offset,
            end: offset + matchText.length,
            replacement: `${ingredientTextToUse} to taste`,
          });
        }
      } else if (ing.quantity !== null && ing.quantity > 0) {
        const quantityStr = formatQuantity(ing.quantity, ing.unit);
        const unitStr = ing.unit ? ` ${ing.unit}` : "";

        if (hasQuantityBefore && quantityMatch) {
          const quantityStart = lookbackStart + (quantityMatch.index || 0);
          const replacement = `${quantityStr}${unitStr} ${ingredientTextToUse}`;
          replacements.push({
            start: quantityStart,
            end: offset + matchText.length,
            replacement,
          });
        } else {
          const replacement = `${quantityStr}${unitStr} ${ingredientTextToUse}`;
          replacements.push({
            start: offset,
            end: offset + matchText.length,
            replacement,
          });
        }
      }
    }
  });

  replacements.sort((a, b) => b.start - a.start);
  replacements.forEach(({ start, end, replacement }) => {
    enrichedText =
      enrichedText.substring(0, start) +
      replacement +
      enrichedText.substring(end);
  });

  return enrichedText;
}

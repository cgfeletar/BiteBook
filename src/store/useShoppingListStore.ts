import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingItem, Ingredient } from '../types';
import { mergeIngredients } from '../utils/shoppingListUtils';
import { getAisleForIngredient } from '../utils/aisleMapper';

/**
 * Clean ingredient name and re-parse if it contains quantity/unit information
 * Handles cases where name includes "½ cups (680g) King Arthur Gluten-Free Bread Flour"
 * Also combines existing quantity with fraction in name (e.g., quantity: 4, name: "½ cups" → 4.5)
 */
function cleanAndParseIngredient(ing: Ingredient): { name: string; quantity: number | null; unit: string } {
  // If name doesn't contain numbers or units, use as-is
  const hasQuantityOrUnit = /\d|½|¼|¾|⅓|⅔|⅛|⅜|⅝|⅞|cup|tsp|tbsp|gram|g|kg|ml|l|oz|lb|pound|ounce|teaspoon|tablespoon/i.test(ing.name);
  
  if (!hasQuantityOrUnit && ing.quantity !== null && ing.unit) {
    // Name is clean, use existing values
    return {
      name: ing.name.trim(),
      quantity: ing.quantity,
      unit: ing.unit,
    };
  }

  // Name contains quantity/unit info, need to parse it
  let name = ing.name;
  let quantity = ing.quantity;
  let unit = ing.unit;

  // Convert Unicode fractions to regular fractions
  const unicodeFractions: Record<string, string> = {
    '½': '1/2',
    '¼': '1/4',
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
  };
  
  let normalizedName = name;
  for (const [unicode, fraction] of Object.entries(unicodeFractions)) {
    normalizedName = normalizedName.replace(new RegExp(unicode, 'g'), fraction);
  }

  // Pattern to match: optional whole number, optional fraction, optional unit, ingredient name
  const mixedNumberPattern = /^(\d+)\s+(\d+\/\d+)/;
  const fractionPattern = /^(\d+\/\d+)/;
  const decimalPattern = /^(\d+\.\d+)/;
  const wholeNumberPattern = /^(\d+)(?!\/)/;

  let remaining = normalizedName.trim();
  let parsedQuantity: number | null = null;
  let parsedUnit = '';
  let foundFraction = false;

  // Try to match mixed number first (e.g., "4 1/2")
  const mixedMatch = remaining.match(mixedNumberPattern);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const fraction = mixedMatch[2];
    const [num, den] = fraction.split("/").map(Number);
    parsedQuantity = whole + num / den;
    remaining = remaining.substring(mixedMatch[0].length).trim();
    foundFraction = true;
  } else {
    // Try fraction FIRST (e.g., "1/2")
    const fracMatch = remaining.match(fractionPattern);
    if (fracMatch) {
      const [num, den] = fracMatch[1].split("/").map(Number);
      const fractionValue = num / den;
      
      // If we have an existing whole number quantity, combine them (e.g., quantity: 4, name: "1/2 cups" → 4.5)
      if (ing.quantity !== null && ing.quantity > 0 && ing.quantity < 100) {
        // Likely a whole number, combine with fraction
        parsedQuantity = ing.quantity + fractionValue;
      } else {
        // Just use the fraction
        parsedQuantity = fractionValue;
      }
      
      remaining = remaining.substring(fracMatch[0].length).trim();
      foundFraction = true;
    } else {
      // Try decimal
      const decMatch = remaining.match(decimalPattern);
      if (decMatch) {
        parsedQuantity = parseFloat(decMatch[1]);
        remaining = remaining.substring(decMatch[0].length).trim();
      } else {
        // Try whole number
        const wholeMatch = remaining.match(wholeNumberPattern);
        if (wholeMatch) {
          parsedQuantity = parseInt(wholeMatch[1], 10);
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
  ];

  // Try to match a unit
  for (const pattern of unitPatterns) {
    const unitMatch = remaining.match(pattern);
    if (unitMatch) {
      parsedUnit = unitMatch[1].toLowerCase();
      remaining = remaining.substring(unitMatch[0].length).trim();
      break;
    }
  }

  // Remove parenthetical content like "(680g)"
  remaining = remaining.replace(/\([^)]*\)/g, '').trim();

  // Use parsed values if we found them, otherwise use original
  return {
    name: remaining || ing.name.trim(),
    quantity: parsedQuantity !== null ? parsedQuantity : ing.quantity,
    unit: parsedUnit || ing.unit,
  };
}

interface ShoppingListState {
  items: ShoppingItem[];
  addItems: (ingredients: Ingredient[], recipeId?: string) => void;
  addShoppingItems: (items: ShoppingItem[]) => void;
  togglePurchased: (id: string) => void;
  deleteItem: (id: string) => void;
  clearPurchased: () => void;
  clearAll: () => void;
}

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set) => ({
      items: [],
  
  addItems: (ingredients: Ingredient[], recipeId?: string) => {
    const shoppingItems: ShoppingItem[] = ingredients.map((ing) => {
      // Clean and parse the ingredient to extract correct name, quantity, and unit
      const cleaned = cleanAndParseIngredient(ing);
      
      const item = {
        id: `${Date.now()}-${Math.random()}`,
        name: cleaned.name,
        quantity: cleaned.quantity,
        unit: cleaned.unit,
        isPurchased: false,
        originalRecipeId: recipeId,
        aisle: getAisleForIngredient(cleaned.name),
      };
      console.log('🔵 Adding item to shopping list:', {
        original: { name: ing.name, quantity: ing.quantity, unit: ing.unit },
        cleaned: { name: cleaned.name, quantity: cleaned.quantity, unit: cleaned.unit },
        fullItem: item,
      });
      return item;
    });

    set((state) => ({
      items: mergeIngredients(state.items, shoppingItems),
    }));
  },

  addShoppingItems: (newItems: ShoppingItem[]) => {
    set((state) => ({
      items: mergeIngredients(state.items, newItems),
    }));
  },

  togglePurchased: (id: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
      ),
    }));
  },

  deleteItem: (id: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  clearPurchased: () => {
    set((state) => ({
      items: state.items.filter((item) => !item.isPurchased),
    }));
  },

      clearAll: () => {
        set({ items: [] });
      },
    }),
    {
      name: "shopping-list-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);


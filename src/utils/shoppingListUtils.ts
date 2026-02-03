import { ShoppingItem } from '../types';

/**
 * Normalizes ingredient name for comparison (case-insensitive, trimmed, handles plurals)
 * Converts plural forms to singular for consistent matching
 * Removes common quantity prefixes like "pinch of", "dash of", etc.
 */
function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Handle empty strings
  if (!normalized) return normalized;
  
  // Remove common quantity prefixes
  const prefixPatterns = [
    /^pinch\s+of\s+/i,
    /^pinches\s+of\s+/i,
    /^dash\s+of\s+/i,
    /^dashes\s+of\s+/i,
    /^splash\s+of\s+/i,
    /^handful\s+of\s+/i,
    /^handfuls\s+of\s+/i,
    /^sprig\s+of\s+/i,
    /^sprigs\s+of\s+/i,
    /^bunch\s+of\s+/i,
    /^bunches\s+of\s+/i,
    /^clove\s+of\s+/i,
    /^cloves\s+of\s+/i,
    /^slice\s+of\s+/i,
    /^slices\s+of\s+/i,
    /^piece\s+of\s+/i,
    /^pieces\s+of\s+/i,
    /^drop\s+of\s+/i,
    /^drops\s+of\s+/i,
    /^drizzle\s+of\s+/i,
    /^touch\s+of\s+/i,
    /^hint\s+of\s+/i,
  ];
  
  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }
  normalized = normalized.trim();
  
  // Common irregular plurals that need special handling
  const irregularPlurals: Record<string, string> = {
    'eggs': 'egg',
    'children': 'child',
    'feet': 'foot',
    'teeth': 'tooth',
    'geese': 'goose',
    'mice': 'mouse',
    'leaves': 'leaf',
    'knives': 'knife',
    'lives': 'life',
    'wives': 'wife',
    'loaves': 'loaf',
    'thieves': 'thief',
    'shelves': 'shelf',
    'wolves': 'wolf',
    'calves': 'calf',
    'halves': 'half',
  };
  
  // Check for irregular plural first
  if (irregularPlurals[normalized]) {
    return irregularPlurals[normalized];
  }
  
  // Handle regular plurals
  // Words ending in 'ies' -> 'y' (e.g., "cherries" -> "cherry")
  if (normalized.endsWith('ies') && normalized.length > 3) {
    return normalized.slice(0, -3) + 'y';
  }
  
  // Words ending in 'es' (but not 'ies') -> remove 'es' (e.g., "tomatoes" -> "tomato")
  // Common patterns: words ending in s, x, z, ch, sh add 'es'
  if (normalized.endsWith('es') && normalized.length > 2) {
    const beforeEs = normalized.slice(0, -2);
    const lastChar = beforeEs[beforeEs.length - 1];
    // Only remove 'es' if it's a valid plural ending
    if (['s', 'x', 'z', 'h'].includes(lastChar) || normalized.endsWith('ches') || normalized.endsWith('shes')) {
      return beforeEs;
    }
  }
  
  // Words ending in 's' -> remove 's' (e.g., "eggs" -> "egg", "apples" -> "apple")
  // But avoid removing 's' from words that end in 's' in singular form
  if (normalized.endsWith('s') && normalized.length > 1) {
    // Don't remove 's' from words that are typically singular but end in 's'
    // These are mass nouns that don't have a plural form
    const singularWordsEndingInS = ['rice', 'juice', 'sauce'];
    if (!singularWordsEndingInS.includes(normalized)) {
      return normalized.slice(0, -1);
    }
  }
  
  return normalized;
}

/**
 * Gets the preferred (singular) form of an ingredient name
 * Converts to singular while preserving original capitalization style
 */
function getPreferredName(name: string): string {
  const normalized = normalizeName(name);
  if (!normalized || normalized === name.toLowerCase().trim()) {
    // No change needed, return original
    return name.trim();
  }
  
  // Preserve capitalization: if original was capitalized, capitalize the result
  const original = name.trim();
  const isCapitalized = original.length > 0 && original[0] === original[0].toUpperCase();
  
  if (isCapitalized && normalized.length > 0) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  
  return normalized;
}

/**
 * Normalizes unit for comparison (case-insensitive, handles plurals)
 */
function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  // Handle common plural/singular variations
  const unitMap: Record<string, string> = {
    'cups': 'cup',
    'c': 'cup',
    'tablespoons': 'tbsp',
    'tbsps': 'tbsp',
    'tbsp': 'tbsp',
    'teaspoons': 'tsp',
    'tsps': 'tsp',
    'tsp': 'tsp',
    'pounds': 'lb',
    'lbs': 'lb',
    'lb': 'lb',
    'ounces': 'oz',
    'oz': 'oz',
    'grams': 'g',
    'g': 'g',
    'kilograms': 'kg',
    'kg': 'kg',
    'milliliters': 'ml',
    'ml': 'ml',
    'liters': 'l',
    'l': 'l',
  };
  return unitMap[normalized] || normalized;
}

/**
 * Merges new ingredients into the current shopping list
 * 
 * Logic:
 * - If an ingredient with the same name and unit exists, add quantities
 * - If name matches but unit differs, keep as separate items
 * - New items are added to the list
 * 
 * @param currentList - Current shopping list items
 * @param newIngredients - New ingredients to merge in
 * @returns Merged shopping list
 */
export function mergeIngredients(
  currentList: ShoppingItem[],
  newIngredients: ShoppingItem[]
): ShoppingItem[] {
  // Create a copy of the current list to avoid mutations
  const mergedList: ShoppingItem[] = [...currentList];
  
  // Create a map for quick lookup by normalized name and unit
  const itemMap = new Map<string, ShoppingItem>();
  
  mergedList.forEach((item) => {
    const key = `${normalizeName(item.name)}|${normalizeUnit(item.unit)}`;
    itemMap.set(key, item);
  });
  
  // Process new ingredients
  newIngredients.forEach((newItem) => {
    const normalizedName = normalizeName(newItem.name);
    const normalizedUnit = normalizeUnit(newItem.unit);
    const key = `${normalizedName}|${normalizedUnit}`;
    
    const existingItem = itemMap.get(key);
    
    if (existingItem) {
      // Merge: add quantities and update the existing item
      existingItem.quantity += newItem.quantity;
      // Update name to preferred (singular) form for consistency
      // This ensures "egg" and "eggs" both become "egg"
      // Since both names normalize to the same value, the map key doesn't change
      const preferredName = getPreferredName(existingItem.name);
      if (preferredName !== existingItem.name) {
        existingItem.name = preferredName;
      }
      // Preserve other properties from existing item (isPurchased, originalRecipeId, etc.)
    } else {
      // New item: add to the list with preferred (singular) name
      const preferredName = getPreferredName(newItem.name);
      const itemToAdd: ShoppingItem = {
        ...newItem,
        name: preferredName,
        // Ensure isPurchased is false for new items
        isPurchased: newItem.isPurchased || false,
      };
      mergedList.push(itemToAdd);
      // Use normalized name for the map key
      const normalizedKey = `${normalizeName(preferredName)}|${normalizedUnit}`;
      itemMap.set(normalizedKey, itemToAdd);
    }
  });
  
  return mergedList;
}

/**
 * Example usage:
 * 
 * const currentList: ShoppingItem[] = [
 *   { id: '1', name: 'Sugar', quantity: 1, unit: 'cup', isPurchased: false }
 * ];
 * 
 * const newIngredients: ShoppingItem[] = [
 *   { id: '2', name: 'Sugar', quantity: 0.5, unit: 'cup', isPurchased: false }
 * ];
 * 
 * const merged = mergeIngredients(currentList, newIngredients);
 * // Result: [{ id: '1', name: 'Sugar', quantity: 1.5, unit: 'cup', isPurchased: false }]
 */


import { ShoppingItem } from '../types';

/**
 * Normalizes ingredient name for comparison (case-insensitive, trimmed)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim();
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
      // Preserve other properties from existing item (isPurchased, originalRecipeId, etc.)
    } else {
      // New item: add to the list
      const itemToAdd: ShoppingItem = {
        ...newItem,
        // Ensure isPurchased is false for new items
        isPurchased: newItem.isPurchased || false,
      };
      mergedList.push(itemToAdd);
      itemMap.set(key, itemToAdd);
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


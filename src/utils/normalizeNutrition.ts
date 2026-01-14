import { NutritionalInfo } from "../types";

/**
 * Checks if nutritional info needs AI generation.
 * Returns true if:
 * - No nutritional info at all
 * - All required values are 0 (no data from source)
 * - Some but not all required fields have values (partial data)
 * 
 * Required fields: calories, protein, carbohydrates, sugar, fat
 */
export function isNutritionIncomplete(
  nutritionalInfo: NutritionalInfo | undefined | null
): boolean {
  if (!nutritionalInfo) return true;

  const requiredFields = [
    "calories",
    "protein",
    "carbohydrates",
    "sugar",
    "fat",
  ];
  
  // Count how many required fields have actual values (non-zero)
  const nonZeroCount = requiredFields.filter(
    (field) =>
      nutritionalInfo[field] !== undefined &&
      nutritionalInfo[field] !== null &&
      nutritionalInfo[field] !== 0
  ).length;

  // Need to generate if:
  // - All values are 0 (no nutrition data from source)
  // - Some values exist but not all (partial data)
  // Only skip generation if ALL required fields have non-zero values
  return nonZeroCount < requiredFields.length;
}

/**
 * Normalizes nutritional info to ensure required fields are always present.
 * Sets missing values to 0 (not null) so they can be displayed.
 *
 * Required fields: calories, protein, carbohydrates, sugar, fat
 */
export function normalizeNutrition(
  nutritionalInfo: NutritionalInfo | undefined | null
): NutritionalInfo {
  // Start with existing nutrition or empty object
  const nutrition = nutritionalInfo || {};

  // Ensure all required fields are present (default to 0 if missing)
  return {
    ...nutrition,
    calories: nutrition.calories ?? 0,
    protein: nutrition.protein ?? 0,
    carbohydrates: nutrition.carbohydrates ?? 0,
    sugar: nutrition.sugar ?? 0,
    fat: nutrition.fat ?? 0,
    // Preserve other optional fields (fiber, sodium, isPerServing, etc.)
    fiber: nutrition.fiber,
    sodium: nutrition.sodium,
    isPerServing: nutrition.isPerServing,
  };
}

/**
 * Helper to pick the better value: prefer non-zero existing, else use generated
 * A value of 0 from the source usually means "no data" not "actually 0 calories"
 */
function pickValue(existing: number | undefined | null, generated: number | undefined | null): number {
  // If existing has a meaningful (non-zero) value, keep it
  if (existing !== undefined && existing !== null && existing !== 0) {
    return existing;
  }
  // Otherwise use the generated value (or 0 as fallback)
  return generated ?? 0;
}

/**
 * Merges existing nutrition with generated nutrition.
 * Uses generated values when existing is 0 (meaning no data from source).
 * Only keeps existing values if they're non-zero (actual data from source).
 */
export function mergeNutrition(
  existing: NutritionalInfo | undefined | null,
  generated: NutritionalInfo
): NutritionalInfo {
  const existingNutrition = existing || {};

  return {
    // Use generated values when existing is 0 or missing
    calories: pickValue(existingNutrition.calories, generated.calories),
    protein: pickValue(existingNutrition.protein, generated.protein),
    carbohydrates: pickValue(existingNutrition.carbohydrates, generated.carbohydrates),
    sugar: pickValue(existingNutrition.sugar, generated.sugar),
    fat: pickValue(existingNutrition.fat, generated.fat),
    // For optional fields, prefer existing non-null values
    fiber: existingNutrition.fiber ?? generated.fiber,
    sodium: existingNutrition.sodium ?? generated.sodium,
    // Preserve isPerServing from existing if it exists
    isPerServing: existingNutrition.isPerServing ?? generated.isPerServing,
  };
}

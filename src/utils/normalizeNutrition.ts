import { NutritionalInfo } from "../types";

/**
 * Checks if nutritional info is incomplete (has some but not all required fields)
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
  const hasSomeValues = requiredFields.some(
    (field) =>
      nutritionalInfo[field] !== undefined &&
      nutritionalInfo[field] !== null &&
      nutritionalInfo[field] !== 0
  );
  const hasAllValues = requiredFields.every(
    (field) =>
      nutritionalInfo[field] !== undefined &&
      nutritionalInfo[field] !== null &&
      nutritionalInfo[field] !== 0
  );

  // Incomplete if we have some values but not all
  return hasSomeValues && !hasAllValues;
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
 * Merges existing nutrition with generated nutrition, preferring existing values
 * and filling in missing values from generated
 */
export function mergeNutrition(
  existing: NutritionalInfo | undefined | null,
  generated: NutritionalInfo
): NutritionalInfo {
  const existingNutrition = existing || {};

  return {
    // Prefer existing values, fall back to generated
    calories: existingNutrition.calories ?? generated.calories ?? 0,
    protein: existingNutrition.protein ?? generated.protein ?? 0,
    carbohydrates:
      existingNutrition.carbohydrates ?? generated.carbohydrates ?? 0,
    sugar: existingNutrition.sugar ?? generated.sugar ?? 0,
    fat: existingNutrition.fat ?? generated.fat ?? 0,
    // Preserve optional fields from existing, fall back to generated
    fiber: existingNutrition.fiber ?? generated.fiber,
    sodium: existingNutrition.sodium ?? generated.sodium,
    // Preserve isPerServing from existing if it exists
    isPerServing: existingNutrition.isPerServing ?? generated.isPerServing,
  };
}

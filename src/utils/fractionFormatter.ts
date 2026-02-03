/**
 * Formats a decimal number to at most 2 decimal places
 * Removes leading zero for values less than 1 (e.g., 0.33 → ".33")
 * Examples:
 * - 1.234 → "1.23"
 * - 0.333 → ".33"
 * - 2.0 → "2"
 * - 1.5 → "1.5"
 * - 0.5 → ".5"
 */
export function formatDecimal(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  // If it's a whole number, return without decimals
  if (Number.isInteger(num)) return num.toString();
  // Cap at 2 decimal places and remove trailing zeros
  let formatted = num.toFixed(2).replace(/\.?0+$/, "");
  // Remove leading zero for values less than 1 (0.33 → .33)
  if (num > 0 && num < 1 && formatted.startsWith("0.")) {
    formatted = formatted.substring(1); // Remove the leading "0"
  }
  return formatted;
}

/**
 * Converts a decimal number to a mixed fraction string
 * Priority: fractions > decimal without leading zero > decimal with 2 places
 * Examples:
 * - 1.25 → "1 1/4"
 * - 0.5 → "1/2"
 * - 2.75 → "2 3/4"
 * - 1.0 → "1"
 * - 0.333 → "1/3"
 * - 0.666 → "2/3"
 * - 0.15 → ".15" (no common fraction match)
 */
export function formatAsFraction(decimal: number): string {
  // Handle whole numbers
  if (Number.isInteger(decimal)) {
    return decimal.toString();
  }

  // Common fractions and their decimal equivalents (with tolerance for matching)
  const commonFractions: Array<[number, string]> = [
    [0.125, "1/8"],
    [0.25, "1/4"],
    [0.333, "1/3"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.666, "2/3"],
    [0.75, "3/4"],
    [0.875, "7/8"],
  ];

  // Find the closest common fraction
  const wholePart = Math.floor(decimal);
  const fractionalPart = decimal - wholePart;

  // If fractional part is very small, treat as whole number
  if (fractionalPart < 0.01) {
    return wholePart.toString();
  }

  // Find the closest matching fraction
  let closestFraction = commonFractions[0];
  let minDiff = Math.abs(fractionalPart - closestFraction[0]);

  for (const [value, fraction] of commonFractions) {
    const diff = Math.abs(fractionalPart - value);
    if (diff < minDiff) {
      minDiff = diff;
      closestFraction = [value, fraction];
    }
  }

  // Use fraction if within tolerance (0.05 = 5% tolerance)
  // This matches 0.333 to 1/3, 0.666 to 2/3, etc.
  if (minDiff <= 0.05) {
    if (wholePart === 0) {
      return closestFraction[1];
    } else {
      return `${wholePart} ${closestFraction[1]}`;
    }
  }

  // No good fraction match - fall back to decimal without leading zero
  return formatDecimal(decimal);
}

/**
 * Calculates the exact fraction representation of a decimal
 * Uses continued fractions for accuracy
 */
function calculateExactFraction(
  decimal: number,
  maxDenominator: number = 64
): string {
  const wholePart = Math.floor(decimal);
  const fractionalPart = decimal - wholePart;

  if (fractionalPart === 0) {
    return wholePart.toString();
  }

  // Use continued fractions to find the best approximation
  let bestNum = 0;
  let bestDen = 1;
  let bestError = Math.abs(fractionalPart);

  for (let den = 1; den <= maxDenominator; den++) {
    const num = Math.round(fractionalPart * den);
    const error = Math.abs(fractionalPart - num / den);
    if (error < bestError) {
      bestError = error;
      bestNum = num;
      bestDen = den;
    }
  }

  // Simplify the fraction
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(bestNum, bestDen);
  const simplifiedNum = bestNum / divisor;
  const simplifiedDen = bestDen / divisor;

  if (wholePart === 0) {
    return `${simplifiedNum}/${simplifiedDen}`;
  } else {
    return `${wholePart} ${simplifiedNum}/${simplifiedDen}`;
  }
}

/**
 * Formats a quantity for display, converting decimals to fractions when appropriate
 * Only converts to fractions for common cooking units (cups, tsp, tbsp, etc.)
 * Leaves whole items (eggs, pieces, etc.) as-is
 */
export function formatQuantity(
  quantity: number | null,
  unit: string | null
): string {
  // Handle null quantity (for "to taste" ingredients)
  if (quantity === null || quantity === undefined) {
    return "";
  }

  // Handle null unit (for "to taste" ingredients)
  if (!unit) {
    return quantity.toString();
  }

  // Don't convert to fractions for whole items or non-volume units
  const wholeItemUnits = [
    "egg",
    "eggs",
    "piece",
    "pieces",
    "whole",
    "item",
    "items",
    "large",
    "medium",
    "small",
  ];
  const isWholeItem = wholeItemUnits.some((u) =>
    unit.toLowerCase().includes(u)
  );

  // Don't convert for metric units (grams, kg, etc.) unless it's a volume unit
  const volumeUnits = [
    "cup",
    "cups",
    "tsp",
    "tbsp",
    "tablespoon",
    "teaspoon",
    "fl oz",
    "ounce",
    "oz",
  ];
  const isVolumeUnit = volumeUnits.some((u) => unit.toLowerCase().includes(u));

  // Only format as fraction for volume units, not whole items
  if (isWholeItem || (!isVolumeUnit && !unit.toLowerCase().includes("cup"))) {
    // For whole items, always return as whole number (round if needed)
    if (isWholeItem) {
      const rounded = Math.round(quantity);
      return rounded < 1 && quantity > 0 ? "1" : rounded.toString();
    }
    // For other non-volume units, return formatted decimal (capped at 2 places)
    return formatDecimal(quantity);
  }

  // Format as fraction for volume units
  return formatAsFraction(quantity);
}

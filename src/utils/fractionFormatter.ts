/**
 * Formats a decimal number to at most 2 decimal places
 * Examples:
 * - 1.234 → "1.23"
 * - 0.333 → "0.33"
 * - 2.0 → "2"
 * - 1.5 → "1.5"
 */
export function formatDecimal(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  // If it's a whole number, return without decimals
  if (Number.isInteger(num)) return num.toString();
  // Otherwise, cap at 2 decimal places
  return num.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Converts a decimal number to a mixed fraction string
 * Examples:
 * - 1.25 → "1 1/4"
 * - 0.5 → "1/2"
 * - 2.75 → "2 3/4"
 * - 1.0 → "1"
 * - 0.33 → "1/3" (approximate)
 */
export function formatAsFraction(decimal: number): string {
  // Handle whole numbers
  if (Number.isInteger(decimal)) {
    return decimal.toString();
  }

  // Common fractions and their decimal equivalents
  const commonFractions: Array<[number, string]> = [
    [0.125, "1/8"],
    [0.25, "1/4"],
    [0.333, "1/3"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.667, "2/3"],
    [0.75, "3/4"],
    [0.875, "7/8"],
  ];

  // Find the closest common fraction
  const wholePart = Math.floor(decimal);
  const fractionalPart = decimal - wholePart;

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

  // If the difference is too large, use the decimal (shouldn't happen for common fractions)
  if (minDiff > 0.1) {
    // For uncommon fractions, calculate the exact fraction
    return calculateExactFraction(decimal);
  }

  // Build the result
  if (wholePart === 0) {
    return closestFraction[1];
  } else {
    return `${wholePart} ${closestFraction[1]}`;
  }
}

/**
 * Calculates the exact fraction representation of a decimal
 * Uses continued fractions for accuracy
 */
function calculateExactFraction(decimal: number, maxDenominator: number = 64): string {
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
  quantity: number,
  unit: string | null
): string {
  // Handle null unit (for "to taste" ingredients)
  if (!unit) {
    return quantity.toString();
  }

  // Don't convert to fractions for whole items or non-volume units
  const wholeItemUnits = ["egg", "eggs", "piece", "pieces", "whole", "item", "items", "large", "medium", "small"];
  const isWholeItem = wholeItemUnits.some((u) =>
    unit.toLowerCase().includes(u)
  );

  // Don't convert for metric units (grams, kg, etc.) unless it's a volume unit
  const volumeUnits = ["cup", "cups", "tsp", "tbsp", "tablespoon", "teaspoon", "fl oz", "ounce", "oz"];
  const isVolumeUnit = volumeUnits.some((u) =>
    unit.toLowerCase().includes(u)
  );

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


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
  "Bakery",
  "Frozen",
  "Baking",
  "Pantry",
  "Beverages",
  "Snacks",
  "Other",
];

/**
 * Maps ingredient names to grocery store aisles based on common patterns
 */
export function getAisleForIngredient(ingredientName: string): Aisle {
  const name = ingredientName.toLowerCase().trim();

  // Produce
  if (
    name.includes("apple") ||
    name.includes("banana") ||
    name.includes("orange") ||
    name.includes("lettuce") ||
    name.includes("tomato") ||
    name.includes("onion") ||
    name.includes("garlic") ||
    name.includes("pepper") ||
    name.includes("carrot") ||
    name.includes("celery") ||
    name.includes("potato") ||
    name.includes("spinach") ||
    name.includes("mushroom") ||
    name.includes("herb") ||
    name.includes("basil") ||
    name.includes("parsley") ||
    name.includes("cilantro") ||
    name.includes("lemon") ||
    name.includes("lime") ||
    name.includes("avocado") ||
    name.includes("cucumber") ||
    name.includes("zucchini") ||
    name.includes("broccoli") ||
    name.includes("cauliflower")
  ) {
    return "Produce";
  }

  // Meat & Seafood
  if (
    name.includes("chicken") ||
    name.includes("beef") ||
    name.includes("pork") ||
    name.includes("turkey") ||
    name.includes("lamb") ||
    name.includes("fish") ||
    name.includes("salmon") ||
    name.includes("tuna") ||
    name.includes("shrimp") ||
    name.includes("crab") ||
    name.includes("lobster") ||
    name.includes("bacon") ||
    name.includes("sausage") ||
    name.includes("ham")
  ) {
    return "Meat & Seafood";
  }

  // Dairy
  if (
    name.includes("milk") ||
    name.includes("cheese") ||
    name.includes("butter") ||
    name.includes("cream") ||
    name.includes("yogurt") ||
    name.includes("sour cream") ||
    name.includes("cottage cheese") ||
    name.includes("egg") ||
    name.includes("mozzarella") ||
    name.includes("cheddar") ||
    name.includes("parmesan")
  ) {
    return "Dairy";
  }

  // Bakery
  if (
    name.includes("bread") ||
    name.includes("bagel") ||
    name.includes("croissant") ||
    name.includes("roll") ||
    name.includes("bun") ||
    name.includes("tortilla") ||
    name.includes("pita")
  ) {
    return "Bakery";
  }

  // Frozen
  if (
    name.includes("frozen") ||
    name.includes("ice cream") ||
    name.includes("frozen vegetable") ||
    name.includes("frozen fruit")
  ) {
    return "Frozen";
  }

  // Baking (baking ingredients)
  if (
    name.includes("flour") ||
    name.includes("sugar") ||
    name.includes("salt") ||
    name.includes("pepper") ||
    name.includes("spice") ||
    name.includes("oil") ||
    name.includes("vinegar") ||
    name.includes("seed") ||
    name.includes("honey") ||
    name.includes("syrup") ||
    name.includes("baking") ||
    name.includes("vanilla") ||
    name.includes("cocoa") ||
    name.includes("chocolate") ||
    name.includes("chocolate chip") ||
    name.includes("baking powder") ||
    name.includes("baking soda") ||
    name.includes("yeast") ||
    name.includes("cinnamon") ||
    name.includes("nutmeg")
  ) {
    return "Baking";
  }

  // Beverages
  if (
    name.includes("juice") ||
    name.includes("soda") ||
    name.includes("water") ||
    name.includes("coffee") ||
    name.includes("tea") ||
    name.includes("wine") ||
    name.includes("beer")
  ) {
    return "Beverages";
  }

  // Pantry (dry goods, grains, canned items)
  if (
    name.includes("pasta") ||
    name.includes("spaghetti") ||
    name.includes("penne") ||
    name.includes("macaroni") ||
    name.includes("noodle") ||
    name.includes("rice") ||
    name.includes("quinoa") ||
    name.includes("barley") ||
    name.includes("oats") ||
    name.includes("oatmeal") ||
    name.includes("bean") ||
    name.includes("lentil") ||
    name.includes("chickpea") ||
    name.includes("black bean") ||
    name.includes("kidney bean") ||
    name.includes("canned") ||
    name.includes("broth") ||
    name.includes("stock") ||
    name.includes("marinara") ||
    name.includes("pasta sauce") ||
    name.includes("tomato sauce") ||
    name.includes("crushed tomato") ||
    name.includes("diced tomato") ||
    name.includes("coconut milk") ||
    name.includes("coconut cream")
  ) {
    return "Pantry";
  }

  // Snacks
  if (
    name.includes("chip") ||
    name.includes("cracker") ||
    name.includes("cookie") ||
    name.includes("pretzel") ||
    name.includes("popcorn")
  ) {
    return "Snacks";
  }

  return "Other";
}

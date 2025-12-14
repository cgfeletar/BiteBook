import { Timestamp } from "firebase/firestore";

/**
 * Ingredient interface for recipe ingredients
 */
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  isChecked: boolean;
}

/**
 * Step interface for recipe instructions
 */
export interface Step {
  id: string;
  instruction: string;
  isCompleted: boolean;
  isBeginnerFriendly: boolean;
  timerDuration?: number; // Duration in seconds
  title?: string; // Optional title for instruction sections (e.g., "Make the dough")
}

/**
 * Nutritional information interface
 */
export interface NutritionalInfo {
  calories?: number;
  protein?: number; // in grams
  carbohydrates?: number; // in grams
  fat?: number; // in grams
  fiber?: number; // in grams
  sugar?: number; // in grams
  sodium?: number; // in milligrams
  [key: string]: number | undefined; // Allow additional nutritional fields
}

/**
 * Recipe interface for Firestore documents
 */
export interface Recipe {
  id: string;
  title: string;
  coverImage: string; // URL or path to image
  ingredients: Ingredient[];
  steps: Step[];
  nutritionalInfo: NutritionalInfo;
  sourceUrl: string;
  originalAuthor: string;
  tags: string[];
  categoryIds: string[];
  rating?: number; // 1-5 star rating
  prepTime?: number; // Prep time in minutes (active prep time)
  cookTime?: number; // Cook time in minutes
  createdAt: Timestamp | Date;
}

/**
 * Category interface for recipe categories
 */
export interface Category {
  id: string;
  name: string;
  coverImageId: string;
}

/**
 * ShoppingItem interface for shopping list items
 */
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isPurchased: boolean;
  originalRecipeId?: string;
  aisle?: string;
}

/**
 * PantryItem interface for pantry inventory
 */
export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: Timestamp | Date;
}

// Type helpers for Firestore operations
export type RecipeCreateInput = Omit<Recipe, "id" | "createdAt"> & {
  createdAt?: Timestamp | Date;
};

export type RecipeUpdateInput = Partial<Omit<Recipe, "id" | "createdAt">>;

export type CategoryCreateInput = Omit<Category, "id">;

export type CategoryUpdateInput = Partial<Omit<Category, "id">>;

export type ShoppingItemCreateInput = Omit<ShoppingItem, "id">;

export type ShoppingItemUpdateInput = Partial<Omit<ShoppingItem, "id">>;

export type PantryItemCreateInput = Omit<PantryItem, "id">;

export type PantryItemUpdateInput = Partial<Omit<PantryItem, "id">>;

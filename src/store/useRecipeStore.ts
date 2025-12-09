import { create } from "zustand";
import { Timestamp } from "firebase/firestore";
import { Recipe, RecipeCreateInput } from "../types";

interface RecipeStore {
  recipes: Recipe[];
  addRecipe: (recipe: RecipeCreateInput) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  getRecipe: (id: string) => Recipe | undefined;
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],

  addRecipe: (recipeData: RecipeCreateInput) => {
    const newRecipe: Recipe = {
      ...recipeData,
      id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: recipeData.createdAt || Timestamp.now(),
    };

    set((state) => ({
      recipes: [newRecipe, ...state.recipes], // Add to beginning for newest first
    }));

    return newRecipe;
  },

  updateRecipe: (id: string, updates: Partial<Recipe>) => {
    set((state) => ({
      recipes: state.recipes.map((recipe) =>
        recipe.id === id ? { ...recipe, ...updates } : recipe
      ),
    }));
  },

  deleteRecipe: (id: string) => {
    set((state) => ({
      recipes: state.recipes.filter((recipe) => recipe.id !== id),
    }));
  },

  getRecipe: (id: string) => {
    return get().recipes.find((recipe) => recipe.id === id);
  },
}));


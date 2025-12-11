import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timestamp } from "firebase/firestore";
import { Recipe, RecipeCreateInput } from "../types";

interface RecipeStore {
  recipes: Recipe[];
  addRecipe: (recipe: RecipeCreateInput) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  getRecipe: (id: string) => Recipe | undefined;
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: "recipe-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Handle Timestamp serialization for Firestore Timestamps
      partialize: (state) => ({
        ...state,
        recipes: state.recipes.map((recipe) => ({
          ...recipe,
          // Convert Timestamp to plain object for storage
          createdAt:
            recipe.createdAt instanceof Timestamp
              ? {
                  seconds: recipe.createdAt.seconds,
                  nanoseconds: recipe.createdAt.nanoseconds,
                  _isTimestamp: true,
                }
              : recipe.createdAt instanceof Date
              ? recipe.createdAt.toISOString()
              : recipe.createdAt,
        })),
      }),
      // Convert back to Timestamp on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.recipes = state.recipes.map((recipe) => ({
            ...recipe,
            createdAt:
              recipe.createdAt &&
              typeof recipe.createdAt === "object" &&
              "_isTimestamp" in recipe.createdAt
                ? new Timestamp(
                    recipe.createdAt.seconds,
                    recipe.createdAt.nanoseconds
                  )
                : typeof recipe.createdAt === "string"
                ? new Date(recipe.createdAt)
                : recipe.createdAt,
          }));
        }
      },
    }
  )
);


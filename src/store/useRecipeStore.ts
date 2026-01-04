import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timestamp } from "firebase/firestore";
import { Recipe, RecipeCreateInput } from "../types";
import {
  addRecipeToFirestore,
  updateRecipeInFirestore,
  deleteRecipeFromFirestore,
  subscribeToKitchenRecipes,
  getKitchenRecipes,
} from "../services/recipeFirestoreService";
import { Unsubscribe } from "firebase/firestore";

interface RecipeStore {
  recipes: Recipe[];
  loading: boolean;
  synced: boolean;
  unsubscribe: Unsubscribe | null;
  addRecipe: (recipe: RecipeCreateInput, kitchenId?: string) => Promise<Recipe>;
  updateRecipe: (id: string, updates: Partial<Recipe>, kitchenId?: string) => Promise<void>;
  deleteRecipe: (id: string, kitchenId?: string) => Promise<void>;
  getRecipe: (id: string) => Recipe | undefined;
  loadRecipesFromFirestore: (kitchenId: string) => Promise<void>;
  subscribeToRecipes: (kitchenId: string) => void;
  unsubscribeFromRecipes: () => void;
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: [],
      loading: false,
      synced: false,
      unsubscribe: null,

      addRecipe: async (recipeData: RecipeCreateInput, kitchenId?: string) => {
        const newRecipe: Recipe = {
          ...recipeData,
          id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: recipeData.createdAt || Timestamp.now(),
        };

        console.log("Adding recipe to store:", {
          id: newRecipe.id,
          title: newRecipe.title,
          coverImage: newRecipe.coverImage,
          coverImageLength: newRecipe.coverImage?.length,
        });

        // Update local state immediately
        set((state) => ({
          recipes: [newRecipe, ...state.recipes], // Add to beginning for newest first
        }));

        // Sync to Firestore if kitchenId is provided
        if (kitchenId) {
          try {
            await addRecipeToFirestore(kitchenId, recipeData);
            console.log("Recipe synced to Firestore");
          } catch (error) {
            console.error("Failed to sync recipe to Firestore:", error);
            // Recipe is still in local state, will sync later
          }
        }

        return newRecipe;
      },

      updateRecipe: async (id: string, updates: Partial<Recipe>, kitchenId?: string) => {
        // Update local state immediately
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id ? { ...recipe, ...updates } : recipe
          ),
        }));

        // Sync to Firestore if kitchenId is provided
        if (kitchenId) {
          try {
            await updateRecipeInFirestore(kitchenId, id, updates);
            console.log("Recipe update synced to Firestore");
          } catch (error) {
            console.error("Failed to sync recipe update to Firestore:", error);
          }
        }
      },

      deleteRecipe: async (id: string, kitchenId?: string) => {
        // Update local state immediately
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
        }));

        // Sync to Firestore if kitchenId is provided
        if (kitchenId) {
          try {
            await deleteRecipeFromFirestore(kitchenId, id);
            console.log("Recipe deletion synced to Firestore");
          } catch (error) {
            console.error("Failed to sync recipe deletion to Firestore:", error);
          }
        }
      },

      getRecipe: (id: string) => {
        return get().recipes.find((recipe) => recipe.id === id);
      },

      loadRecipesFromFirestore: async (kitchenId: string) => {
        if (!kitchenId) return;

        set({ loading: true });
        try {
          const recipes = await getKitchenRecipes(kitchenId);
          set({ recipes, synced: true, loading: false });
          console.log(`Loaded ${recipes.length} recipes from Firestore`);
        } catch (error) {
          console.error("Failed to load recipes from Firestore:", error);
          set({ loading: false });
        }
      },

      subscribeToRecipes: (kitchenId: string) => {
        if (!kitchenId) return;

        // Unsubscribe from previous subscription if exists
        const currentUnsubscribe = get().unsubscribe;
        if (currentUnsubscribe) {
          currentUnsubscribe();
        }

        try {
          const unsubscribe = subscribeToKitchenRecipes(kitchenId, (recipes) => {
            set({ recipes, synced: true });
            console.log(`Received ${recipes.length} recipes from Firestore subscription`);
          });

          set({ unsubscribe });
        } catch (error) {
          console.error("Failed to subscribe to recipes:", error);
        }
      },

      unsubscribeFromRecipes: () => {
        const unsubscribe = get().unsubscribe;
        if (unsubscribe) {
          unsubscribe();
          set({ unsubscribe: null });
        }
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


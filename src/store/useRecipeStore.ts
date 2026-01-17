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
import { normalizeNutrition } from "../utils/normalizeNutrition";

// Helper to remove undefined values from objects (Firestore doesn't accept undefined)
const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Timestamp)) {
        result[key] = stripUndefined(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }
  return result;
};

interface RecipeStore {
  recipes: Recipe[];
  loading: boolean;
  synced: boolean;
  unsubscribe: Unsubscribe | null;
  // Note: These functions update local state immediately and sync to Firestore in background
  addRecipe: (recipe: RecipeCreateInput, kitchenId?: string) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>, kitchenId?: string) => void;
  deleteRecipe: (id: string, kitchenId?: string) => void;
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

      addRecipe: (recipeData: RecipeCreateInput, kitchenId?: string) => {
        // Normalize nutrition to ensure required fields are always present
        const normalizedNutrition = normalizeNutrition(recipeData.nutritionalInfo);
        
        const newRecipe: Recipe = {
          ...recipeData,
          nutritionalInfo: normalizedNutrition,
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

        // Sync to Firestore in background (non-blocking for faster UX)
        // Recipe is already in local state, so user sees it immediately
        if (kitchenId) {
          // Strip undefined values - Firestore doesn't accept them
          const recipeDataToSync = stripUndefined({
            ...recipeData,
            nutritionalInfo: stripUndefined(normalizedNutrition),
          });
          console.log("Starting Firestore sync for recipe:", newRecipe.title, "to kitchen:", kitchenId);
          console.log("📦 Data being synced:", JSON.stringify({
            title: recipeDataToSync.title,
            hasImage: !!recipeDataToSync.coverImage,
            ingredientCount: recipeDataToSync.ingredients?.length,
            stepCount: recipeDataToSync.steps?.length,
          }));
          // Fire-and-forget: don't await, let it sync in background
          addRecipeToFirestore(kitchenId, recipeDataToSync)
            .then((firestoreId) => console.log("✅ Recipe synced to Firestore with ID:", firestoreId))
            .catch((error) => {
              console.error("❌ Failed to sync recipe to Firestore:", error);
              console.error("Recipe that failed:", newRecipe.title);
              console.error("Kitchen ID:", kitchenId);
            });
        } else {
          console.warn("⚠️ No kitchenId provided - recipe only saved locally!", newRecipe.title);
        }

        return newRecipe;
      },

      updateRecipe: (id: string, updates: Partial<Recipe>, kitchenId?: string) => {
        // Normalize nutrition if it's being updated
        const normalizedUpdates = updates.nutritionalInfo
          ? { ...updates, nutritionalInfo: normalizeNutrition(updates.nutritionalInfo) }
          : updates;
        
        // Update local state immediately
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id ? { ...recipe, ...normalizedUpdates } : recipe
          ),
        }));

        // Sync to Firestore in background (non-blocking)
        // Strip undefined values - Firestore doesn't accept them
        if (kitchenId) {
          const updatesToSync = stripUndefined(normalizedUpdates);
          updateRecipeInFirestore(kitchenId, id, updatesToSync)
            .then(() => console.log("✅ Recipe update synced to Firestore"))
            .catch((error) => console.error("❌ Failed to sync recipe update to Firestore:", error));
        }
      },

      deleteRecipe: (id: string, kitchenId?: string) => {
        // Update local state immediately
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
        }));

        // Sync to Firestore in background (non-blocking)
        if (kitchenId) {
          deleteRecipeFromFirestore(kitchenId, id)
            .then(() => console.log("Recipe deletion synced to Firestore"))
            .catch((error) => console.error("Failed to sync recipe deletion to Firestore:", error));
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
          // Normalize nutrition for all loaded recipes to ensure required fields are present
          const normalizedRecipes = recipes.map((recipe) => ({
            ...recipe,
            nutritionalInfo: normalizeNutrition(recipe.nutritionalInfo),
          }));
          set({ recipes: normalizedRecipes, synced: true, loading: false });
          console.log(`Loaded ${normalizedRecipes.length} recipes from Firestore`);
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
            // Normalize nutrition for all recipes from subscription to ensure required fields are present
            const normalizedRecipes = recipes.map((recipe) => ({
              ...recipe,
              nutritionalInfo: normalizeNutrition(recipe.nutritionalInfo),
            }));
            // Log recipe titles to debug duplicates
            console.log(`📥 Firestore subscription: ${normalizedRecipes.length} recipes:`, 
              normalizedRecipes.map(r => `${r.title || 'UNTITLED'} (${r.id})`).join(', '));
            set({ recipes: normalizedRecipes, synced: true });
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


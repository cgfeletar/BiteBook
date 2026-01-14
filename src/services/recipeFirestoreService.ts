import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Recipe, RecipeCreateInput } from "../types";

/**
 * Add a recipe to Firestore (associated with a kitchen)
 */
export async function addRecipeToFirestore(
  kitchenId: string,
  recipeData: RecipeCreateInput
): Promise<string> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const recipesRef = collection(db, "kitchens", kitchenId, "recipes");
  const docRef = await addDoc(recipesRef, {
    ...recipeData,
    createdAt: recipeData.createdAt || serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Update a recipe in Firestore
 * If the document doesn't exist, it will be created with the updates
 */
export async function updateRecipeInFirestore(
  kitchenId: string,
  recipeId: string,
  updates: Partial<Recipe>
): Promise<void> {
  if (!kitchenId || !recipeId) {
    throw new Error("kitchenId and recipeId are required");
  }

  const recipeRef = doc(db, "kitchens", kitchenId, "recipes", recipeId);
  
  // Check if document exists
  const recipeSnap = await getDoc(recipeRef);
  
  if (recipeSnap.exists()) {
    // Document exists, update it
  await updateDoc(recipeRef, updates);
  } else {
    // Document doesn't exist, create it with the updates
    // This handles the case where a recipe exists locally but hasn't been synced yet
    await setDoc(recipeRef, {
      ...updates,
      createdAt: updates.createdAt || serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Delete a recipe from Firestore
 */
export async function deleteRecipeFromFirestore(
  kitchenId: string,
  recipeId: string
): Promise<void> {
  if (!kitchenId || !recipeId) {
    throw new Error("kitchenId and recipeId are required");
  }

  const recipeRef = doc(db, "kitchens", kitchenId, "recipes", recipeId);
  await deleteDoc(recipeRef);
}

/**
 * Get a single recipe from Firestore
 */
export async function getRecipeFromFirestore(
  kitchenId: string,
  recipeId: string
): Promise<Recipe | null> {
  if (!kitchenId || !recipeId) {
    throw new Error("kitchenId and recipeId are required");
  }

  const recipeRef = doc(db, "kitchens", kitchenId, "recipes", recipeId);
  const recipeSnap = await getDoc(recipeRef);

  if (!recipeSnap.exists()) {
    return null;
  }

  return {
    id: recipeSnap.id,
    ...recipeSnap.data(),
  } as Recipe;
}

/**
 * Get all recipes for a kitchen
 */
export async function getKitchenRecipes(
  kitchenId: string
): Promise<Recipe[]> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const recipesRef = collection(db, "kitchens", kitchenId, "recipes");
  const q = query(recipesRef, orderBy("createdAt", "desc"));
  const recipesSnap = await getDocs(q);

  return recipesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Recipe[];
}

/**
 * Subscribe to recipes for a kitchen (real-time updates)
 */
export function subscribeToKitchenRecipes(
  kitchenId: string,
  callback: (recipes: Recipe[]) => void
): Unsubscribe {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const recipesRef = collection(db, "kitchens", kitchenId, "recipes");
  const q = query(recipesRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const recipes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Recipe[];
    callback(recipes);
  });
}


/**
 * Migrate all recipes from one kitchen to another
 * This copies recipes (does not delete from source)
 * Used when a user joins another kitchen to merge their recipes
 * @param fromKitchenId - The source kitchen ID
 * @param toKitchenId - The destination kitchen ID  
 * @returns The number of recipes migrated
 */
export async function migrateRecipesToKitchen(
  fromKitchenId: string,
  toKitchenId: string
): Promise<number> {
  if (!fromKitchenId || !toKitchenId) {
    throw new Error("Both fromKitchenId and toKitchenId are required");
  }

  // Don't migrate if source and destination are the same
  if (fromKitchenId === toKitchenId) {
    console.log(`[migrateRecipes] Source and destination are the same, skipping migration`);
    return 0;
  }

  console.log(`[migrateRecipes] Starting migration from ${fromKitchenId} to ${toKitchenId}`);

  try {
    // Get all recipes from the source kitchen
    const sourceRecipes = await getKitchenRecipes(fromKitchenId);
    
    if (sourceRecipes.length === 0) {
      console.log(`[migrateRecipes] No recipes to migrate from ${fromKitchenId}`);
      return 0;
    }

    console.log(`[migrateRecipes] Found ${sourceRecipes.length} recipes to migrate`);

    // Get existing recipes in destination to avoid duplicates (by sourceUrl)
    const destRecipes = await getKitchenRecipes(toKitchenId);
    const existingSourceUrls = new Set(destRecipes.map(r => r.sourceUrl).filter(Boolean));

    let migratedCount = 0;

    // Copy each recipe to the destination kitchen
    for (const recipe of sourceRecipes) {
      // Skip if a recipe with the same source URL already exists
      if (recipe.sourceUrl && existingSourceUrls.has(recipe.sourceUrl)) {
        console.log(`[migrateRecipes] Skipping duplicate recipe: ${recipe.title} (same sourceUrl exists)`);
        continue;
      }

      // Create recipe in destination kitchen (without the old id)
      const { id, ...recipeData } = recipe;
      const recipesRef = collection(db, "kitchens", toKitchenId, "recipes");
      
      await addDoc(recipesRef, {
        ...recipeData,
        migratedFrom: fromKitchenId, // Track origin for debugging
        migratedAt: serverTimestamp(),
      });

      migratedCount++;
      console.log(`[migrateRecipes] Migrated recipe: ${recipe.title}`);
    }

    console.log(`[migrateRecipes] Successfully migrated ${migratedCount} recipes`);
    return migratedCount;
  } catch (error: any) {
    console.error(`[migrateRecipes] Failed to migrate recipes:`, {
      fromKitchenId,
      toKitchenId,
      error: error?.message,
      code: error?.code,
    });
    throw error;
  }
}

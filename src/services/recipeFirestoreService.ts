import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
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
 * Only updates if the document exists - won't create partial docs
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
    // Document doesn't exist - skip update
    // This happens when local recipe ID doesn't match Firestore ID
    // The recipe will sync properly via the subscription
    console.warn(`⚠️ Recipe ${recipeId} not found in Firestore - skipping update`);
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
export async function getKitchenRecipes(kitchenId: string): Promise<Recipe[]> {
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
    console.log(
      `[migrateRecipes] Source and destination are the same, skipping migration`
    );
    return 0;
  }

  console.log(
    `[migrateRecipes] Starting migration from ${fromKitchenId} to ${toKitchenId}`
  );

  try {
    // Get all recipes from the source kitchen
    const sourceRecipes = await getKitchenRecipes(fromKitchenId);

    if (sourceRecipes.length === 0) {
      console.log(
        `[migrateRecipes] No recipes to migrate from ${fromKitchenId}`
      );
      return 0;
    }

    console.log(
      `[migrateRecipes] Found ${sourceRecipes.length} recipes to migrate`
    );

    // Get existing recipes in destination to avoid duplicates
    const destRecipes = await getKitchenRecipes(toKitchenId);
    console.log(
      `[migrateRecipes] Destination has ${destRecipes.length} existing recipes`
    );

    // Build multiple sets for robust duplicate detection
    const existingSourceUrls = new Set(
      destRecipes.map((r) => r.sourceUrl).filter(Boolean)
    );
    const existingTitles = new Set(
      destRecipes.map((r) => r.title?.toLowerCase().trim()).filter(Boolean)
    );
    // Track recipes already migrated from this specific source kitchen
    const alreadyMigratedTitles = new Set(
      destRecipes
        .filter((r: any) => r.migratedFrom === fromKitchenId)
        .map((r) => r.title?.toLowerCase().trim())
        .filter(Boolean)
    );

    let migratedCount = 0;
    let skippedCount = 0;

    // Copy each recipe to the destination kitchen
    for (const recipe of sourceRecipes) {
      const normalizedTitle = recipe.title?.toLowerCase().trim();

      // Skip if already migrated from this exact source kitchen
      if (normalizedTitle && alreadyMigratedTitles.has(normalizedTitle)) {
        console.log(
          `[migrateRecipes] Skip: "${recipe.title}" (already migrated from this kitchen)`
        );
        skippedCount++;
        continue;
      }

      // Skip if a recipe with the same source URL already exists
      if (recipe.sourceUrl && existingSourceUrls.has(recipe.sourceUrl)) {
        console.log(
          `[migrateRecipes] Skip: "${recipe.title}" (same sourceUrl exists)`
        );
        skippedCount++;
        continue;
      }

      // Skip if a recipe with the same title already exists
      if (normalizedTitle && existingTitles.has(normalizedTitle)) {
        console.log(
          `[migrateRecipes] Skip: "${recipe.title}" (same title exists)`
        );
        skippedCount++;
        continue;
      }

      // Create recipe in destination kitchen (without the old id)
      const { id, ...recipeData } = recipe;
      const recipesRef = collection(db, "kitchens", toKitchenId, "recipes");

      await addDoc(recipesRef, {
        ...recipeData,
        migratedFrom: fromKitchenId,
        migratedAt: serverTimestamp(),
      });

      // Add to tracking sets to prevent duplicates within same batch
      if (recipe.sourceUrl) existingSourceUrls.add(recipe.sourceUrl);
      if (normalizedTitle) {
        existingTitles.add(normalizedTitle);
        alreadyMigratedTitles.add(normalizedTitle);
      }

      migratedCount++;
      console.log(`[migrateRecipes] Migrated: "${recipe.title}"`);
    }

    console.log(
      `[migrateRecipes] Complete: ${migratedCount} migrated, ${skippedCount} skipped`
    );
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

/**
 * Remove duplicate recipes from a kitchen
 * Keeps the oldest version of each recipe (by title)
 * @param kitchenId - The kitchen ID to clean up
 * @returns The number of duplicates removed
 */
export async function removeDuplicateRecipes(
  kitchenId: string
): Promise<number> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  console.log(`[removeDuplicates] Starting cleanup for kitchen ${kitchenId}`);

  try {
    const recipes = await getKitchenRecipes(kitchenId);
    console.log(`[removeDuplicates] Found ${recipes.length} total recipes`);

    // Group recipes by normalized title
    const recipesByTitle = new Map<string, Recipe[]>();
    for (const recipe of recipes) {
      const normalizedTitle = recipe.title?.toLowerCase().trim() || "";
      if (!recipesByTitle.has(normalizedTitle)) {
        recipesByTitle.set(normalizedTitle, []);
      }
      recipesByTitle.get(normalizedTitle)!.push(recipe);
    }

    let removedCount = 0;

    // For each group with more than one recipe, keep the oldest and delete the rest
    for (const [title, group] of recipesByTitle) {
      if (group.length > 1) {
        console.log(
          `[removeDuplicates] Found ${group.length} copies of "${title}"`
        );

        // Sort by createdAt (oldest first) - keep the first one
        group.sort((a, b) => {
          const aTime =
            a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : (a.createdAt as any)?.toDate?.()?.getTime() || 0;
          const bTime =
            b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : (b.createdAt as any)?.toDate?.()?.getTime() || 0;
          return aTime - bTime;
        });

        // Delete all but the first (oldest)
        for (let i = 1; i < group.length; i++) {
          const duplicate = group[i];
          console.log(
            `[removeDuplicates] Removing duplicate: "${duplicate.title}" (id: ${duplicate.id})`
          );
          await deleteRecipeFromFirestore(kitchenId, duplicate.id);
          removedCount++;
        }
      }
    }

    console.log(`[removeDuplicates] Removed ${removedCount} duplicates`);
    return removedCount;
  } catch (error: any) {
    console.error(`[removeDuplicates] Failed:`, {
      kitchenId,
      error: error?.message,
      code: error?.code,
    });
    throw error;
  }
}

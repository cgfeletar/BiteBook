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


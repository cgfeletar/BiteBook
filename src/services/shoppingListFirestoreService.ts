import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { ShoppingItem } from "../types";

/**
 * Get or create shopping list for a kitchen
 */
export async function getKitchenShoppingList(
  kitchenId: string
): Promise<ShoppingItem[]> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const shoppingListRef = collection(db, "kitchens", kitchenId, "shoppingList");
  const shoppingListSnap = await getDocs(shoppingListRef);

  return shoppingListSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ShoppingItem[];
}

/**
 * Add or update shopping list items for a kitchen
 */
export async function updateKitchenShoppingList(
  kitchenId: string,
  items: ShoppingItem[]
): Promise<void> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  // Delete all existing items first, then add new ones
  const shoppingListRef = collection(db, "kitchens", kitchenId, "shoppingList");
  const existingSnap = await getDocs(shoppingListRef);
  
  // Delete existing items
  const deletePromises = existingSnap.docs.map((doc) =>
    deleteDoc(doc.ref)
  );
  await Promise.all(deletePromises);

  // Add new items
  const addPromises = items.map((item) => {
    const itemRef = doc(shoppingListRef, item.id);
    return setDoc(itemRef, item);
  });
  await Promise.all(addPromises);
}

/**
 * Add a single item to shopping list
 */
export async function addShoppingListItem(
  kitchenId: string,
  item: ShoppingItem
): Promise<void> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const itemRef = doc(
    db,
    "kitchens",
    kitchenId,
    "shoppingList",
    item.id
  );
  await setDoc(itemRef, item);
}

/**
 * Update a single shopping list item
 */
export async function updateShoppingListItem(
  kitchenId: string,
  itemId: string,
  updates: Partial<ShoppingItem>
): Promise<void> {
  if (!kitchenId || !itemId) {
    throw new Error("kitchenId and itemId are required");
  }

  const itemRef = doc(db, "kitchens", kitchenId, "shoppingList", itemId);
  await updateDoc(itemRef, updates);
}

/**
 * Delete a shopping list item
 */
export async function deleteShoppingListItem(
  kitchenId: string,
  itemId: string
): Promise<void> {
  if (!kitchenId || !itemId) {
    throw new Error("kitchenId and itemId are required");
  }

  const itemRef = doc(db, "kitchens", kitchenId, "shoppingList", itemId);
  await deleteDoc(itemRef);
}

/**
 * Subscribe to shopping list for a kitchen (real-time updates)
 */
export function subscribeToKitchenShoppingList(
  kitchenId: string,
  callback: (items: ShoppingItem[]) => void
): Unsubscribe {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const shoppingListRef = collection(db, "kitchens", kitchenId, "shoppingList");

  return onSnapshot(shoppingListRef, (snapshot) => {
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ShoppingItem[];
    callback(items);
  });
}


import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { User } from "../store/useAuthStore";
import { createKitchen } from "./kitchenService";

export interface UserDocument {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt: any; // Firestore Timestamp
  defaultKitchenId: string;
}

/**
 * Create or update a user document in Firestore
 * This is called after successful authentication
 */
export async function createOrUpdateUser(user: User): Promise<void> {
  if (!user.uid) {
    throw new Error("User UID is required");
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const userData: Partial<UserDocument> = {
    uid: user.uid,
    email: user.email || undefined,
    displayName: user.displayName || undefined,
    defaultKitchenId: user.defaultKitchenId || generateUniqueId(),
  };

  if (!userSnap.exists()) {
    // New user - create kitchen first, then user document
    const kitchenId = user.defaultKitchenId || generateUniqueId();
    await createKitchen(user.uid, kitchenId);
    
    // Create document with createdAt and kitchenId
    await setDoc(userRef, {
      ...userData,
      defaultKitchenId: kitchenId,
      createdAt: serverTimestamp(),
    });
  } else {
    // Existing user - check if they have a kitchen, create one if not
    const existingData = userSnap.data();
    let kitchenId = existingData?.defaultKitchenId || user.defaultKitchenId;
    
    // If no kitchen exists, create one
    if (!kitchenId) {
      kitchenId = generateUniqueId();
      await createKitchen(user.uid, kitchenId);
    }
    
    // Update user document with kitchenId
    await setDoc(
      userRef,
      {
        ...userData,
        defaultKitchenId: kitchenId,
        // Preserve createdAt for existing users
        createdAt: existingData.createdAt || serverTimestamp(),
      },
      { merge: true }
    );
  }
}

/**
 * Get user document from Firestore
 */
export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return userSnap.data() as UserDocument;
}

/**
 * Generate a unique identifier for defaultKitchenId
 */
function generateUniqueId(): string {
  return `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


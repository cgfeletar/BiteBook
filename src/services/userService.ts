import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { User } from "../store/useAuthStore";
import { createKitchen } from "./kitchenService";

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * Note: null values are kept (they're valid in Firestore)
 */
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

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

  const path = `users/${user.uid}`;
  console.log(`[createOrUpdateUser] Operation: setDoc, Path: ${path}`);
  console.log(`[createOrUpdateUser] Auth state before write:`, {
    uid: auth.currentUser?.uid,
    email: auth.currentUser?.email,
    displayName: auth.currentUser?.displayName,
    photoURL: auth.currentUser?.photoURL,
    isAuthenticated: !!auth.currentUser,
  });
  console.log(`[createOrUpdateUser] User data received:`, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    defaultKitchenId: user.defaultKitchenId,
  });

  try {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

    // Build user data with proper null handling (not undefined)
    // Use auth.currentUser as source of truth for email/displayName if not provided
    const email = user.email ?? auth.currentUser?.email ?? null;
    const displayName = user.displayName ?? auth.currentUser?.displayName ?? null;
    const photoURL = user.photoURL ?? auth.currentUser?.photoURL ?? null;

    // Build payload object
    const userDataPayload: Record<string, any> = {
    uid: user.uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL,
    defaultKitchenId: user.defaultKitchenId || generateUniqueId(),
  };

    // Remove undefined values (Firestore doesn't allow undefined)
    const sanitizedPayload = stripUndefined(userDataPayload);

  if (!userSnap.exists()) {
    // New user - create kitchen first, then user document
    const kitchenId = user.defaultKitchenId || generateUniqueId();
    await createKitchen(user.uid, kitchenId);
    
    // Create document with createdAt and kitchenId
      const createPayload = {
        ...sanitizedPayload,
      defaultKitchenId: kitchenId,
      createdAt: serverTimestamp(),
      };
      
      console.log(`[createOrUpdateUser] Creating new user with payload:`, createPayload);
      await setDoc(userRef, createPayload);
      console.log(`[createOrUpdateUser] SUCCESS - New user created at path: ${path}`);
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
      // Only update fields that are provided (merge mode)
      const updatePayload = {
        ...sanitizedPayload,
        defaultKitchenId: kitchenId,
        // Preserve createdAt for existing users
        createdAt: existingData.createdAt || serverTimestamp(),
      };
      
      console.log(`[createOrUpdateUser] Updating existing user with payload:`, updatePayload);
      await setDoc(userRef, updatePayload, { merge: true });
      console.log(`[createOrUpdateUser] SUCCESS - User updated at path: ${path}`);
    }
  } catch (error: any) {
    console.error(`[createOrUpdateUser] FAILED - Operation: setDoc, Path: ${path}`, {
      code: error?.code,
      message: error?.message,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
      userUid: user.uid,
    });
    throw error;
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


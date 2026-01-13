import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";

export interface Kitchen {
  id: string;
  name?: string;
  createdBy: string; // uid of the user who created the kitchen
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface KitchenMember {
  userId: string;
  joinedAt: Timestamp | Date;
  role?: "owner" | "member"; // owner is the creator, members are invited
}

/**
 * Create a new kitchen
 * @param userId - The user ID creating the kitchen
 * @param kitchenId - Optional kitchen ID (if not provided, will be generated)
 * @returns The kitchen document ID
 */
export async function createKitchen(
  userId: string,
  kitchenId?: string
): Promise<string> {
  if (!userId) {
    throw new Error("userId is required");
  }

  const id = kitchenId || `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const kitchenRef = doc(db, "kitchens", id);

  try {
    console.log(`Creating kitchen ${id} for user ${userId}`);
    await setDoc(kitchenRef, {
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`Kitchen document created successfully`);

    // Add the creator as the first member
    console.log(`Adding user ${userId} as owner of kitchen ${id}`);
    await addKitchenMember(id, userId, "owner");
    console.log(`Kitchen ${id} created successfully with owner ${userId}`);
  } catch (error: any) {
    console.error(`Error creating kitchen:`, {
      kitchenId: id,
      userId,
      error: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    throw error;
  }

  return id;
}

/**
 * Get a kitchen by ID
 */
export async function getKitchen(kitchenId: string): Promise<Kitchen | null> {
  const path = `kitchens/${kitchenId}`;
  console.log(`[getKitchen] Operation: getDoc, Path: ${path}`);
  console.log(`[getKitchen] Auth UID: ${auth.currentUser?.uid}, Email: ${auth.currentUser?.email}`);
  
  try {
    const kitchenRef = doc(db, "kitchens", kitchenId);
    const kitchenSnap = await getDoc(kitchenRef);

    if (!kitchenSnap.exists()) {
      console.log(`[getKitchen] Kitchen not found at path: ${path}`);
      return null;
    }

    const data = {
      id: kitchenSnap.id,
      ...kitchenSnap.data(),
    } as Kitchen;
    console.log(`[getKitchen] Successfully read kitchen:`, { id: data.id, createdBy: data.createdBy });
    return data;
  } catch (error: any) {
    console.error(`[getKitchen] FAILED - Operation: getDoc, Path: ${path}`, {
      code: error?.code,
      message: error?.message,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
    });
    throw error;
  }
}

/**
 * Add a member to a kitchen
 * @param kitchenId - The kitchen ID
 * @param userId - The user ID to add
 * @param role - The role of the member (default: "member")
 */
export async function addKitchenMember(
  kitchenId: string,
  userId: string,
  role: "owner" | "member" = "member"
): Promise<void> {
  if (!kitchenId || !userId) {
    throw new Error("kitchenId and userId are required");
  }

  const path = `kitchens/${kitchenId}/members/${userId}`;
  console.log(`[addKitchenMember] Operation: setDoc, Path: ${path}`);
  console.log(`[addKitchenMember] Auth UID: ${auth.currentUser?.uid}, Email: ${auth.currentUser?.email}`);
  console.log(`[addKitchenMember] userId: ${userId}, role: ${role}, uidMatch: ${auth.currentUser?.uid === userId}`);

  const memberRef = doc(db, "kitchens", kitchenId, "members", userId);
  
  try {
    await setDoc(memberRef, {
      userId,
      joinedAt: serverTimestamp(),
      role,
    });
    console.log(`[addKitchenMember] SUCCESS - Member added at path: ${path}`);
  } catch (error: any) {
    console.error(`[addKitchenMember] FAILED - Operation: setDoc, Path: ${path}`, {
      kitchenId,
      userId,
      role,
      code: error?.code,
      message: error?.message,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
      uidMatch: auth.currentUser?.uid === userId,
    });
    throw error;
  }
}

/**
 * Remove a member from a kitchen
 * @param kitchenId - The kitchen ID
 * @param userId - The user ID to remove
 */
export async function removeKitchenMember(
  kitchenId: string,
  userId: string
): Promise<void> {
  if (!kitchenId || !userId) {
    throw new Error("kitchenId and userId are required");
  }

  const memberRef = doc(db, "kitchens", kitchenId, "members", userId);
  await memberRef.delete();
}

/**
 * Get all members of a kitchen
 * @param kitchenId - The kitchen ID
 * @returns Array of kitchen members
 */
export async function getKitchenMembers(
  kitchenId: string
): Promise<KitchenMember[]> {
  if (!kitchenId) {
    throw new Error("kitchenId is required");
  }

  const membersRef = collection(db, "kitchens", kitchenId, "members");
  const membersSnap = await getDocs(membersRef);

  return membersSnap.docs.map((doc) => ({
    ...doc.data(),
  })) as KitchenMember[];
}

/**
 * Get all kitchens a user is a member of
 * @param userId - The user ID
 * @returns Array of kitchen IDs
 */
export async function getUserKitchens(userId: string): Promise<string[]> {
  if (!userId) {
    throw new Error("userId is required");
  }

  // Query all kitchens where the user is a member
  const kitchensRef = collection(db, "kitchens");
  const kitchensSnap = await getDocs(kitchensRef);
  
  const kitchenIds: string[] = [];

  for (const kitchenDoc of kitchensSnap.docs) {
    const memberRef = doc(db, "kitchens", kitchenDoc.id, "members", userId);
    const memberSnap = await getDoc(memberRef);
    
    if (memberSnap.exists()) {
      kitchenIds.push(kitchenDoc.id);
    }
  }

  return kitchenIds;
}

/**
 * Check if a user is a member of a kitchen
 * @param kitchenId - The kitchen ID
 * @param userId - The user ID
 * @returns True if user is a member
 */
export async function isKitchenMember(
  kitchenId: string,
  userId: string
): Promise<boolean> {
  if (!kitchenId || !userId) {
    return false;
  }

  const path = `kitchens/${kitchenId}/members/${userId}`;
  console.log(`[isKitchenMember] Operation: getDoc, Path: ${path}`);
  console.log(`[isKitchenMember] Auth UID: ${auth.currentUser?.uid}, Email: ${auth.currentUser?.email}`);
  
  try {
    const memberRef = doc(db, "kitchens", kitchenId, "members", userId);
    const memberSnap = await getDoc(memberRef);
    const exists = memberSnap.exists();
    console.log(`[isKitchenMember] SUCCESS - Member exists: ${exists} at path: ${path}`);
    return exists;
  } catch (error: any) {
    console.error(`[isKitchenMember] FAILED - Operation: getDoc, Path: ${path}`, {
      code: error?.code,
      message: error?.message,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
    });
    throw error;
  }
}


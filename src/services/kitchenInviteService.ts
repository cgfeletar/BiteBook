import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { addKitchenMember, getKitchen, createKitchen, isKitchenMember } from "./kitchenService";

export interface KitchenInvite {
  id: string;
  kitchenId: string;
  createdBy: string; // uid
  createdAt: Timestamp | Date;
  expiresAt: Timestamp | Date;
  used: boolean;
}

/**
 * Create a new kitchen invite
 * @param kitchenId - The kitchen ID to invite to
 * @param userId - The user ID creating the invite
 * @returns The invite document ID
 */
export async function createKitchenInvite(
  kitchenId: string,
  userId: string
): Promise<string> {
  if (!kitchenId || !userId) {
    throw new Error("kitchenId and userId are required");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  const docRef = await addDoc(collection(db, "kitchenInvites"), {
    kitchenId,
    createdBy: userId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
  });

  return docRef.id;
}

/**
 * Get an invite by ID
 * @param inviteId - The invite document ID
 * @returns The invite document or null if not found
 */
export async function getKitchenInvite(
  inviteId: string
): Promise<KitchenInvite | null> {
  const path = `kitchenInvites/${inviteId}`;
  console.log(`[getKitchenInvite] Operation: getDoc, Path: ${path}`);
  console.log(`[getKitchenInvite] Auth UID: ${auth.currentUser?.uid}, Email: ${auth.currentUser?.email}`);
  
  try {
  const inviteRef = doc(db, "kitchenInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
      console.log(`[getKitchenInvite] Invite not found at path: ${path}`);
    return null;
  }

    const data = {
    id: inviteSnap.id,
    ...inviteSnap.data(),
  } as KitchenInvite;
    console.log(`[getKitchenInvite] Successfully read invite:`, { id: data.id, kitchenId: data.kitchenId, used: data.used });
    return data;
  } catch (error: any) {
    console.error(`[getKitchenInvite] FAILED - Operation: getDoc, Path: ${path}`, {
      code: error?.code,
      message: error?.message,
      authUid: auth.currentUser?.uid,
      authEmail: auth.currentUser?.email,
    });
    throw error;
  }
}

/**
 * Validate and use an invite
 * @param inviteId - The invite document ID
 * @param userId - The user ID accepting the invite
 * @returns The kitchen ID if successful
 */
export async function acceptKitchenInvite(
  inviteId: string,
  userId: string
): Promise<string> {
  console.log(`[acceptKitchenInvite] START - inviteId: ${inviteId}, userId: ${userId}`);
  console.log(`[acceptKitchenInvite] Auth state:`, {
    uid: auth.currentUser?.uid,
    email: auth.currentUser?.email,
    isAuthenticated: !!auth.currentUser,
  });

  // Step 1: Get invite document
  const path1 = `kitchenInvites/${inviteId}`;
  console.log(`[acceptKitchenInvite] Step 1: Reading invite document at path: ${path1}`);
  let invite: KitchenInvite | null;
  try {
    invite = await getKitchenInvite(inviteId);
  if (!invite) {
    throw new Error("Invite not found");
    }
    console.log(`[acceptKitchenInvite] Step 1 SUCCESS - Invite found:`, {
      id: invite.id,
      kitchenId: invite.kitchenId,
      createdBy: invite.createdBy,
      used: invite.used,
    });
  } catch (error: any) {
    console.error(`[acceptKitchenInvite] Step 1 FAILED - Operation: getDoc, Path: ${path1}`, {
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }

  if (invite.used) {
    throw new Error("Invite has already been used");
  }

  // Check expiration
  const expiresAt =
    invite.expiresAt instanceof Timestamp
      ? invite.expiresAt.toDate()
      : new Date(invite.expiresAt);
  const now = new Date();

  if (expiresAt < now) {
    throw new Error("Invite has expired");
  }

  // Step 2: Check if kitchen exists
  const path2 = `kitchens/${invite.kitchenId}`;
  console.log(`[acceptKitchenInvite] Step 2: Reading kitchen document at path: ${path2}`);
  let kitchen;
  try {
    kitchen = await getKitchen(invite.kitchenId);
    console.log(`[acceptKitchenInvite] Step 2 SUCCESS - Kitchen exists:`, !!kitchen);
  } catch (error: any) {
    console.error(`[acceptKitchenInvite] Step 2 FAILED - Operation: getDoc, Path: ${path2}`, {
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }

  // Step 3: Create kitchen if it doesn't exist
  if (!kitchen) {
    console.log(`[acceptKitchenInvite] Step 3: Creating kitchen at path: ${path2}`);
    try {
    await createKitchen(invite.createdBy, invite.kitchenId);
      console.log(`[acceptKitchenInvite] Step 3 SUCCESS - Kitchen created`);
    } catch (error: any) {
      console.error(`[acceptKitchenInvite] Step 3 FAILED - Operation: createKitchen, Path: ${path2}`, {
        code: error?.code,
        message: error?.message,
      });
      throw error;
    }
  }

  // Step 4: Check if user is already a member
  const path4 = `kitchens/${invite.kitchenId}/members/${userId}`;
  console.log(`[acceptKitchenInvite] Step 4: Checking membership at path: ${path4}`);
  let alreadyMember: boolean;
  try {
    alreadyMember = await isKitchenMember(invite.kitchenId, userId);
    console.log(`[acceptKitchenInvite] Step 4 SUCCESS - Already member: ${alreadyMember}`);
  } catch (error: any) {
    console.error(`[acceptKitchenInvite] Step 4 FAILED - Operation: isKitchenMember (getDoc), Path: ${path4}`, {
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }

  // Step 5: Add user to kitchen members
  if (!alreadyMember) {
    console.log(`[acceptKitchenInvite] Step 5: Adding member at path: ${path4}`);
    try {
    await addKitchenMember(invite.kitchenId, userId, "member");
      console.log(`[acceptKitchenInvite] Step 5 SUCCESS - Member added`);
    } catch (error: any) {
      console.error(`[acceptKitchenInvite] Step 5 FAILED - Operation: setDoc (addKitchenMember), Path: ${path4}`, {
        code: error?.code,
        message: error?.message,
        authUid: auth.currentUser?.uid,
        userId: userId,
        match: auth.currentUser?.uid === userId,
      });
      throw error;
    }
  }

  // Step 6: Mark invite as used
  const path6 = `kitchenInvites/${inviteId}`;
  console.log(`[acceptKitchenInvite] Step 6: Updating invite at path: ${path6}`);
  try {
  const inviteRef = doc(db, "kitchenInvites", inviteId);
  await updateDoc(inviteRef, {
    used: true,
  });
    console.log(`[acceptKitchenInvite] Step 6 SUCCESS - Invite marked as used`);
  } catch (error: any) {
    console.error(`[acceptKitchenInvite] Step 6 FAILED - Operation: updateDoc, Path: ${path6}`, {
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }

  console.log(`[acceptKitchenInvite] COMPLETE - Successfully accepted invite, kitchenId: ${invite.kitchenId}`);
  return invite.kitchenId;
}


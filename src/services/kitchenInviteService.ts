import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

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
  const inviteRef = doc(db, "kitchenInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    return null;
  }

  return {
    id: inviteSnap.id,
    ...inviteSnap.data(),
  } as KitchenInvite;
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
  const invite = await getKitchenInvite(inviteId);

  if (!invite) {
    throw new Error("Invite not found");
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

  // Mark invite as used
  const inviteRef = doc(db, "kitchenInvites", inviteId);
  await updateDoc(inviteRef, {
    used: true,
  });

  return invite.kitchenId;
}


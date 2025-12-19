import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { create } from "zustand";
import { auth } from "../config/firebase";
import { signInWithGoogle as googleSignIn, signInWithApple as appleSignIn } from "../services/authService";
import { createOrUpdateUser, getUserDocument } from "../services/userService";

// Generic User type that can be extended
export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
  defaultKitchenId?: string;
  // Add additional user properties as needed
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

// Convert Firebase User to generic User
const mapFirebaseUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || undefined,
    displayName: firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined,
    createdAt: firebaseUser.metadata.creationTime
      ? new Date(firebaseUser.metadata.creationTime)
      : undefined,
  };
};

export const useAuthStore = create<AuthState>((set) => {
  // Initialize auth state listener with error handling
  const unsubscribe = onAuthStateChanged(
    auth,
    async (firebaseUser) => {
      if (firebaseUser) {
        // Map Firebase user to our User type
        const mappedUser = mapFirebaseUser(firebaseUser);
        
        // Sync user data to Firestore
        try {
          // Get existing user document to preserve defaultKitchenId if it exists
          const existingUserDoc = await getUserDocument(firebaseUser.uid);
          if (existingUserDoc?.defaultKitchenId) {
            mappedUser!.defaultKitchenId = existingUserDoc.defaultKitchenId;
          }
          
          // Create or update user document in Firestore
          await createOrUpdateUser(mappedUser!);
          
          // Fetch updated user document to get defaultKitchenId
          const updatedUserDoc = await getUserDocument(firebaseUser.uid);
          if (updatedUserDoc) {
            mappedUser!.defaultKitchenId = updatedUserDoc.defaultKitchenId;
          }
        } catch (error) {
          console.error("Error syncing user to Firestore:", error);
          // Continue even if Firestore sync fails
        }
        
        set({
          user: mappedUser,
          loading: false,
          initialized: true,
        });
      } else {
        set({
          user: null,
          loading: false,
          initialized: true,
        });
      }
    },
    (error) => {
      // Handle auth state change errors silently
      // Mark as initialized even on error so app doesn't hang
      set({
        user: null,
        loading: false,
        initialized: true,
      });
    }
  );

  return {
    user: null,
    loading: true,
    initialized: false,

    signIn: async (email: string, password: string) => {
      set({ loading: true });
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        set({ loading: false });
        throw error;
      }
    },

    signUp: async (email: string, password: string) => {
      set({ loading: true });
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        set({ loading: false });
        throw error;
      }
    },

    signInWithGoogle: async () => {
      set({ loading: true });
      try {
        await googleSignIn();
      } catch (error: any) {
        set({ loading: false });
        // Don't throw if user cancelled
        if (error.code === "ERR_CANCELED" || error.message?.includes("cancelled")) {
          return;
        }
        throw error;
      }
    },

    signInWithApple: async () => {
      set({ loading: true });
      try {
        await appleSignIn();
      } catch (error: any) {
        set({ loading: false });
        // Don't throw if user cancelled
        if (error.code === "ERR_CANCELED" || error.message?.includes("cancelled")) {
          return;
        }
        throw error;
      }
    },

    logout: async () => {
      set({ loading: true });
      try {
        await signOut(auth);
        set({ user: null, loading: false });
      } catch (error) {
        set({ loading: false });
        throw error;
      }
    },

    setUser: (user: User | null) => set({ user }),
    setLoading: (loading: boolean) => set({ loading }),
  };
});

// Cleanup function (call this when app unmounts if needed)
export const cleanupAuthListener = () => {
  // The listener is automatically cleaned up when the store is destroyed
  // but you can add custom cleanup logic here if needed
};

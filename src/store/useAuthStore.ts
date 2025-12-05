import { create } from 'zustand';
import { 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../config/firebase';

// Generic User type that can be extended
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Add additional user properties as needed
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

// Convert Firebase User to generic User
const mapFirebaseUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null;
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
};

export const useAuthStore = create<AuthState>((set) => {
  // Initialize auth state listener
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    set({
      user: mapFirebaseUser(firebaseUser),
      loading: false,
      initialized: true,
    });
  });

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


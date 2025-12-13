import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CookingSession {
  recipeId: string;
  completedAt: Date;
  timeSpent: number; // in minutes
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  type: "recipes_cooked" | "time_cooking" | "cuisine_count" | "custom";
  createdAt: Date;
}

interface ProgressStore {
  cookingSessions: CookingSession[];
  challenges: Challenge[];
  addCookingSession: (recipeId: string, timeSpent: number) => void;
  addChallenge: (challenge: Omit<Challenge, "id" | "createdAt">) => void;
  updateChallenge: (id: string, updates: Partial<Challenge>) => void;
  removeChallenge: (id: string) => void;
  getRecipesCooked: () => number;
  getTimeCooking: () => number; // in hours
  getChefLevel: () => { level: number; title: string; progress: number; nextLevel: number };
}

export const CHEF_LEVELS = [
  { level: 1, title: "Home Cook", threshold: 0 },
  { level: 2, title: "Line Cook", threshold: 10 },
  { level: 3, title: "Sous Chef", threshold: 50 },
  { level: 4, title: "Executive Chef", threshold: 100 },
  { level: 5, title: "Master Chef", threshold: 250 },
];

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      cookingSessions: [],
      challenges: [],

      addCookingSession: (recipeId: string, timeSpent: number) => {
        set((state) => ({
          cookingSessions: [
            ...state.cookingSessions,
            {
              recipeId,
              completedAt: new Date(),
              timeSpent,
            },
          ],
        }));
      },

      addChallenge: (challenge) => {
        const newChallenge: Challenge = {
          ...challenge,
          id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        };
        set((state) => ({
          challenges: [...state.challenges, newChallenge],
        }));
      },

      updateChallenge: (id: string, updates: Partial<Challenge>) => {
        set((state) => ({
          challenges: state.challenges.map((challenge) =>
            challenge.id === id ? { ...challenge, ...updates } : challenge
          ),
        }));
      },

      removeChallenge: (id: string) => {
        set((state) => ({
          challenges: state.challenges.filter((challenge) => challenge.id !== id),
        }));
      },

      getRecipesCooked: () => {
        return get().cookingSessions.length;
      },

      getTimeCooking: () => {
        const totalMinutes = get().cookingSessions.reduce(
          (sum, session) => sum + session.timeSpent,
          0
        );
        return Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal place
      },

      getChefLevel: () => {
        const recipesCooked = get().getRecipesCooked();
        let currentLevel = CHEF_LEVELS[0];
        let nextLevel = CHEF_LEVELS[1];

        for (let i = CHEF_LEVELS.length - 1; i >= 0; i--) {
          if (recipesCooked >= CHEF_LEVELS[i].threshold) {
            currentLevel = CHEF_LEVELS[i];
            if (i < CHEF_LEVELS.length - 1) {
              nextLevel = CHEF_LEVELS[i + 1];
            } else {
              nextLevel = { ...CHEF_LEVELS[i], threshold: CHEF_LEVELS[i].threshold + 50 };
            }
            break;
          }
        }

        const progress = recipesCooked - currentLevel.threshold;
        const progressNeeded = nextLevel.threshold - currentLevel.threshold;
        const progressPercentage = Math.min(
          (progress / progressNeeded) * 100,
          100
        );

        return {
          level: currentLevel.level,
          title: currentLevel.title,
          progress: progressPercentage,
          nextLevel: nextLevel.threshold,
        };
      },
    }),
    {
      name: "progress-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Handle Date serialization
      partialize: (state) => ({
        ...state,
        cookingSessions: state.cookingSessions.map((session) => ({
          ...session,
          completedAt: session.completedAt instanceof Date
            ? session.completedAt.toISOString()
            : session.completedAt,
        })),
        challenges: state.challenges.map((challenge) => ({
          ...challenge,
          createdAt: challenge.createdAt instanceof Date
            ? challenge.createdAt.toISOString()
            : challenge.createdAt,
        })),
      }),
      // Convert back to Date on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.cookingSessions = state.cookingSessions.map((session) => ({
            ...session,
            completedAt:
              typeof session.completedAt === "string"
                ? new Date(session.completedAt)
                : session.completedAt,
          }));
          state.challenges = state.challenges.map((challenge) => ({
            ...challenge,
            createdAt:
              typeof challenge.createdAt === "string"
                ? new Date(challenge.createdAt)
                : challenge.createdAt,
          }));
        }
      },
    }
  )
);


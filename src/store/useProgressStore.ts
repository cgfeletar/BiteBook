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
  type: 
    | "recipes_cooked" 
    | "time_cooking" 
    | "cuisine_count" 
    | "streak_days"
    | "tag_count" // For meal types, dietary tags, etc.
    | "quick_meals" // Recipes under a certain prep time
    | "rating_based" // Recipes with certain ratings
    | "custom";
  createdAt: Date;
  // Optional metadata for specific challenge types
  metadata?: {
    tag?: string; // For tag_count challenges (e.g., "breakfast", "vegetarian")
    maxPrepTime?: number; // For quick_meals challenges (in minutes)
    minRating?: number; // For rating_based challenges (1-5)
    streakType?: "consecutive" | "total"; // For streak challenges
  };
}

interface ProgressStore {
  cookingSessions: CookingSession[];
  challenges: Challenge[];
  addCookingSession: (recipeId: string, timeSpent: number) => void;
  addChallenge: (challenge: Omit<Challenge, "id" | "createdAt">) => void;
  updateChallenge: (id: string, updates: Partial<Challenge>) => void;
  removeChallenge: (id: string) => void;
  updateChallengeProgress: (recipes: any[]) => void; // Update all challenge progress
  getRecipesCooked: () => number;
  getTimeCooking: () => number; // in hours
  getChefLevel: () => { level: number; title: string; progress: number; nextLevel: number };
  getStreakDays: () => number; // Get current consecutive days streak
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
        set((state) => {
          const newSessions = [
            ...state.cookingSessions,
            {
              recipeId,
              completedAt: new Date(),
              timeSpent,
            },
          ];
          return { cookingSessions: newSessions };
        });
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

      getStreakDays: () => {
        const sessions = get().cookingSessions;
        if (sessions.length === 0) return 0;

        // Sort sessions by date (most recent first)
        const sortedSessions = [...sessions].sort(
          (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
        );

        // Get unique dates (ignoring time)
        const uniqueDates = new Set<string>();
        sortedSessions.forEach((session) => {
          const date = new Date(session.completedAt);
          date.setHours(0, 0, 0, 0);
          uniqueDates.add(date.toISOString());
        });

        const dates = Array.from(uniqueDates)
          .map((iso) => new Date(iso))
          .sort((a, b) => b.getTime() - a.getTime());

        if (dates.length === 0) return 0;

        // Calculate consecutive days from today backwards
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < dates.length; i++) {
          const expectedDate = new Date(today);
          expectedDate.setDate(today.getDate() - i);
          expectedDate.setHours(0, 0, 0, 0);

          const hasDate = dates.some(
            (d) => d.getTime() === expectedDate.getTime()
          );

          if (hasDate) {
            streak++;
          } else {
            break;
          }
        }

        return streak;
      },

      updateChallengeProgress: (recipes: any[]) => {
        const state = get();
        const updatedChallenges = state.challenges.map((challenge) => {
          let newCurrent = 0;

          switch (challenge.type) {
            case "recipes_cooked":
              newCurrent = state.cookingSessions.length;
              break;

            case "time_cooking":
              const totalMinutes = state.cookingSessions.reduce(
                (sum, session) => sum + session.timeSpent,
                0
              );
              newCurrent = Math.round(totalMinutes / 60 * 10) / 10; // hours
              break;

            case "streak_days":
              // Calculate streak directly
              const sessions = state.cookingSessions;
              if (sessions.length > 0) {
                const uniqueDates = new Set<string>();
                sessions.forEach((session) => {
                  const date = new Date(session.completedAt);
                  date.setHours(0, 0, 0, 0);
                  uniqueDates.add(date.toISOString());
                });

                const dates = Array.from(uniqueDates)
                  .map((iso) => new Date(iso))
                  .sort((a, b) => b.getTime() - a.getTime());

                if (dates.length > 0) {
                  let streak = 0;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  for (let i = 0; i < dates.length; i++) {
                    const expectedDate = new Date(today);
                    expectedDate.setDate(today.getDate() - i);
                    expectedDate.setHours(0, 0, 0, 0);

                    const hasDate = dates.some(
                      (d) => d.getTime() === expectedDate.getTime()
                    );

                    if (hasDate) {
                      streak++;
                    } else {
                      break;
                    }
                  }
                  newCurrent = streak;
                }
              }
              break;

            case "tag_count":
              if (challenge.metadata?.tag) {
                const tag = challenge.metadata.tag.toLowerCase();
                const sessionsWithTag = state.cookingSessions.filter((session) => {
                  const recipe = recipes.find((r) => r.id === session.recipeId);
                  return recipe?.tags?.some(
                    (t: string) => t.toLowerCase() === tag
                  );
                });
                newCurrent = sessionsWithTag.length;
              }
              break;

            case "quick_meals":
              if (challenge.metadata?.maxPrepTime) {
                const quickMeals = state.cookingSessions.filter((session) => {
                  const recipe = recipes.find((r) => r.id === session.recipeId);
                  return (
                    recipe?.prepTime &&
                    recipe.prepTime <= challenge.metadata!.maxPrepTime!
                  );
                });
                newCurrent = quickMeals.length;
              }
              break;

            case "rating_based":
              if (challenge.metadata?.minRating) {
                const ratedRecipes = state.cookingSessions.filter((session) => {
                  const recipe = recipes.find((r) => r.id === session.recipeId);
                  return (
                    recipe?.rating &&
                    recipe.rating >= challenge.metadata!.minRating!
                  );
                });
                newCurrent = ratedRecipes.length;
              }
              break;

            case "cuisine_count":
              const cuisineSet = new Set<string>();
              state.cookingSessions.forEach((session) => {
                const recipe = recipes.find((r) => r.id === session.recipeId);
                recipe?.tags?.forEach((tag: string) => {
                  const normalizedTag = tag.toLowerCase();
                  // Check if it's a cuisine tag (you can expand this list)
                  const cuisines = [
                    "italian",
                    "mexican",
                    "japanese",
                    "french",
                    "thai",
                    "indian",
                    "greek",
                    "chinese",
                    "american",
                    "mediterranean",
                    "korean",
                    "spanish",
                    "vietnamese",
                    "middle-eastern",
                  ];
                  if (cuisines.includes(normalizedTag)) {
                    cuisineSet.add(normalizedTag);
                  }
                });
              });
              newCurrent = cuisineSet.size;
              break;

            default:
              newCurrent = challenge.current;
          }

          return {
            ...challenge,
            current: Math.min(newCurrent, challenge.target), // Cap at target
          };
        });

        set({ challenges: updatedChallenges });
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


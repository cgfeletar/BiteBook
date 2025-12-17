import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MealPlanItem {
  id: string;
  name: string;
  recipeId?: string; // If it's a recipe from the app
  isCustom: boolean; // true if user typed it in, false if it's a recipe
}

export interface DayMealPlan {
  date: string; // ISO date string (YYYY-MM-DD)
  meals: MealPlanItem[];
}

export interface MealPlanStore {
  mealPlans: DayMealPlan[];
  addMeal: (date: string, meal: Omit<MealPlanItem, "id">) => void;
  removeMeal: (date: string, mealId: string) => void;
  getMealsForDate: (date: string) => MealPlanItem[];
  getMealsForWeek: (startDate: Date) => DayMealPlan[];
}

export const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => ({
      mealPlans: [],

      addMeal: (date: string, meal: Omit<MealPlanItem, "id">) => {
        const mealItem: MealPlanItem = {
          ...meal,
          id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        set((state) => {
          const existingDayPlan = state.mealPlans.find(
            (plan) => plan.date === date
          );

          if (existingDayPlan) {
            return {
              mealPlans: state.mealPlans.map((plan) =>
                plan.date === date
                  ? { ...plan, meals: [...plan.meals, mealItem] }
                  : plan
              ),
            };
          } else {
            return {
              mealPlans: [
                ...state.mealPlans,
                { date, meals: [mealItem] },
              ],
            };
          }
        });
      },

      removeMeal: (date: string, mealId: string) => {
        set((state) => ({
          mealPlans: state.mealPlans.map((plan) =>
            plan.date === date
              ? {
                  ...plan,
                  meals: plan.meals.filter((meal) => meal.id !== mealId),
                }
              : plan
          ),
        }));
      },

      getMealsForDate: (date: string) => {
        const dayPlan = get().mealPlans.find((plan) => plan.date === date);
        return dayPlan?.meals || [];
      },

      getMealsForWeek: (startDate: Date) => {
        const weekDates: DayMealPlan[] = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateString = date.toISOString().split("T")[0];
          const dayPlan = get().mealPlans.find(
            (plan) => plan.date === dateString
          );
          weekDates.push(
            dayPlan || { date: dateString, meals: [] }
          );
        }
        return weekDates;
      },
    }),
    {
      name: "meal-plan-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);


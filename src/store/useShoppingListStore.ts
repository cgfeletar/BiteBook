import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingItem, Ingredient } from '../types';
import { mergeIngredients } from '../utils/shoppingListUtils';
import { getAisleForIngredient } from '../utils/aisleMapper';

interface ShoppingListState {
  items: ShoppingItem[];
  addItems: (ingredients: Ingredient[], recipeId?: string) => void;
  addShoppingItems: (items: ShoppingItem[]) => void;
  togglePurchased: (id: string) => void;
  deleteItem: (id: string) => void;
  clearPurchased: () => void;
  clearAll: () => void;
}

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set) => ({
      items: [],
  
  addItems: (ingredients: Ingredient[], recipeId?: string) => {
    const shoppingItems: ShoppingItem[] = ingredients.map((ing) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      isPurchased: false,
      originalRecipeId: recipeId,
      aisle: getAisleForIngredient(ing.name),
    }));

    set((state) => ({
      items: mergeIngredients(state.items, shoppingItems),
    }));
  },

  addShoppingItems: (newItems: ShoppingItem[]) => {
    set((state) => ({
      items: mergeIngredients(state.items, newItems),
    }));
  },

  togglePurchased: (id: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
      ),
    }));
  },

  deleteItem: (id: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  clearPurchased: () => {
    set((state) => ({
      items: state.items.filter((item) => !item.isPurchased),
    }));
  },

      clearAll: () => {
        set({ items: [] });
      },
    }),
    {
      name: "shopping-list-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);


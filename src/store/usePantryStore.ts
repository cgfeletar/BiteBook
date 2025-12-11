import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PantryItem, ShoppingItem } from "../types";
import { mergeIngredients } from "../utils/shoppingListUtils";

interface PantryState {
  items: PantryItem[];
  addItem: (item: Omit<PantryItem, "id">) => void;
  addItems: (items: Omit<PantryItem, "id">[]) => void;
  updateItem: (id: string, updates: Partial<PantryItem>) => void;
  deleteItem: (id: string) => void;
  moveFromShoppingList: (shoppingItem: ShoppingItem) => void;
  clearAll: () => void;
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
      items: [
        {
          id: "p1",
          name: "olive oil",
          quantity: 1,
          unit: "bottle",
        },
        {
          id: "p2",
          name: "salt",
          quantity: 1,
          unit: "container",
        },
        {
          id: "p3",
          name: "pepper",
          quantity: 1,
          unit: "container",
        },
      ],

      addItem: (itemData) => {
        const newItem: PantryItem = {
          ...itemData,
          id: `pantry-${Date.now()}-${Math.random()}`,
        };
        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      addItems: (itemsData) => {
        const newItems: PantryItem[] = itemsData.map((item) => ({
          ...item,
          id: `pantry-${Date.now()}-${Math.random()}`,
        }));

        set((state) => {
          // Merge with existing items using the same logic as shopping list
          const mergedItems = mergeIngredients(
            state.items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              isPurchased: false,
            })),
            newItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              isPurchased: false,
            }))
          );

          return {
            items: mergedItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
            })),
          };
        });
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      moveFromShoppingList: (shoppingItem) => {
        const pantryItem: Omit<PantryItem, "id"> = {
          name: shoppingItem.name,
          quantity: shoppingItem.quantity,
          unit: shoppingItem.unit,
        };

        get().addItem(pantryItem);
      },

      clearAll: () => {
        set({ items: [] });
      },
    }),
    {
      name: "pantry-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

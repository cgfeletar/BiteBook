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
        set((state) => {
          // Check if item already exists (normalized name comparison)
          const normalizedNewName = itemData.name.toLowerCase().trim();
          const existingItem = state.items.find(
            (item) => item.name.toLowerCase().trim() === normalizedNewName
          );

          // If item already exists, don't add duplicate
          if (existingItem) {
            return state;
          }

          // Add new item
          const newItem: PantryItem = {
            ...itemData,
            id: `pantry-${Date.now()}-${Math.random()}`,
          };
          return {
            items: [...state.items, newItem],
          };
        });
      },

      addItems: (itemsData) => {
        set((state) => {
          // Create a set of existing pantry item names (normalized) for quick lookup
          const existingNames = new Set(
            state.items.map((item) => item.name.toLowerCase().trim())
          );

          // Filter out items that already exist in pantry
          const itemsToAdd = itemsData.filter(
            (item) => !existingNames.has(item.name.toLowerCase().trim())
          );

          // If no new items to add, return current state
          if (itemsToAdd.length === 0) {
            return state;
          }

          // Create new items with IDs
          const newItems: PantryItem[] = itemsToAdd.map((item) => ({
            ...item,
            id: `pantry-${Date.now()}-${Math.random()}`,
          }));

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

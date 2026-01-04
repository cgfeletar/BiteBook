import { useEffect } from "react";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";

/**
 * Component that syncs kitchen data (recipes, shopping lists) with Firestore
 * when user is logged in. Should be placed in the app layout.
 */
export function KitchenDataSync() {
  const { user } = useAuthStore();
  const { subscribeToRecipes, unsubscribeFromRecipes } = useRecipeStore();
  const { subscribeToShoppingList, unsubscribeFromShoppingList } = useShoppingListStore();

  useEffect(() => {
    if (user?.defaultKitchenId) {
      // Subscribe to recipes
      subscribeToRecipes(user.defaultKitchenId);
      
      // Subscribe to shopping list
      subscribeToShoppingList(user.defaultKitchenId);

      // Cleanup on unmount or when user changes
      return () => {
        unsubscribeFromRecipes();
        unsubscribeFromShoppingList();
      };
    } else {
      // Unsubscribe if user logs out
      unsubscribeFromRecipes();
      unsubscribeFromShoppingList();
    }
  }, [user?.defaultKitchenId, subscribeToRecipes, unsubscribeFromRecipes, subscribeToShoppingList, unsubscribeFromShoppingList]);

  return null; // This component doesn't render anything
}


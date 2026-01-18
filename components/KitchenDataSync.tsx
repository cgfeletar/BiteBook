import { useEffect, useRef } from "react";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useRecipeStore } from "@/src/store/useRecipeStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";
import { isKitchenMember, createKitchen } from "@/src/services/kitchenService";
import { createOrUpdateUser } from "@/src/services/userService";

/**
 * Component that syncs kitchen data (recipes, shopping lists) with Firestore
 * when user is logged in. Should be placed in the app layout.
 */
export function KitchenDataSync() {
  const { user, setUser } = useAuthStore();
  const { subscribeToRecipes, unsubscribeFromRecipes } = useRecipeStore();
  const { subscribeToShoppingList, unsubscribeFromShoppingList } = useShoppingListStore();
  const isCheckingMembership = useRef(false);

  useEffect(() => {
    if (!user?.uid || !user?.defaultKitchenId) {
      // Unsubscribe if user logs out
      unsubscribeFromRecipes();
      unsubscribeFromShoppingList();
      return;
    }

    const setupSubscriptions = async () => {
      // Check if user is actually a member of their kitchen (handles stale data)
      if (!isCheckingMembership.current) {
        isCheckingMembership.current = true;
        try {
          const isMember = await isKitchenMember(user.defaultKitchenId!, user.uid);
          
          if (!isMember) {
            console.log("[KitchenDataSync] User not a member of their kitchen, creating new one");
            // Create a new kitchen for the user
            const newKitchenId = `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await createKitchen(user.uid, newKitchenId);
            await createOrUpdateUser({ ...user, defaultKitchenId: newKitchenId });
            setUser({ ...user, defaultKitchenId: newKitchenId });
            // The useEffect will re-run with the new kitchenId
            isCheckingMembership.current = false;
            return;
          }
        } catch (error) {
          console.error("[KitchenDataSync] Error checking membership:", error);
          // If we can't check membership, try to subscribe anyway
          // The subscription will fail if there's a real permission issue
        }
        isCheckingMembership.current = false;
      }

      // Subscribe to recipes
      subscribeToRecipes(user.defaultKitchenId!);
      
      // Subscribe to shopping list
      subscribeToShoppingList(user.defaultKitchenId!);
    };

    setupSubscriptions();

      // Cleanup on unmount or when user changes
      return () => {
        unsubscribeFromRecipes();
        unsubscribeFromShoppingList();
      };
  }, [user?.uid, user?.defaultKitchenId, subscribeToRecipes, unsubscribeFromRecipes, subscribeToShoppingList, unsubscribeFromShoppingList, setUser]);

  return null; // This component doesn't render anything
}


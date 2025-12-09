import "@/nativewind-setup";
import { usePantryStore } from "@/src/store/usePantryStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";
import { PantryItem, ShoppingItem } from "@/src/types";
import {
  AISLE_ORDER,
  Aisle,
  getAisleForIngredient,
} from "@/src/utils/aisleMapper";
import {
  ArrowRight,
  Check,
  Package,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ShoppingListScreen() {
  const [isPantryMode, setIsPantryMode] = useState(false);
  const shoppingItems = useShoppingListStore((state) => state.items);
  const togglePurchased = useShoppingListStore(
    (state) => state.togglePurchased
  );
  const deleteShoppingItem = useShoppingListStore((state) => state.deleteItem);
  const addShoppingItems = useShoppingListStore(
    (state) => state.addShoppingItems
  );

  const pantryItems = usePantryStore((state) => state.items);
  const addPantryItem = usePantryStore((state) => state.addItem);
  const deletePantryItem = usePantryStore((state) => state.deleteItem);
  const moveFromShoppingList = usePantryStore(
    (state) => state.moveFromShoppingList
  );

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Convert pantry items to shopping items format for display
  const pantryItemsAsShopping: ShoppingItem[] = pantryItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    isPurchased: false,
  }));

  const currentItems = isPantryMode ? pantryItemsAsShopping : shoppingItems;

  // Group shopping items by aisle (only for shopping list, not pantry)
  const groupedByAisle = useMemo(() => {
    if (isPantryMode) return [];

    // Group items by aisle
    const grouped: Record<string, ShoppingItem[]> = {};

    shoppingItems.forEach((item) => {
      const aisle = item.aisle || getAisleForIngredient(item.name);
      if (!grouped[aisle]) {
        grouped[aisle] = [];
      }
      grouped[aisle].push({ ...item, aisle });
    });

    // Sort items within each aisle (unpurchased first, then alphabetical)
    Object.keys(grouped).forEach((aisle) => {
      grouped[aisle].sort((a, b) => {
        if (a.isPurchased !== b.isPurchased) {
          return a.isPurchased ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
    });

    // Create sections in aisle order
    const sections: Array<{ title: string; data: ShoppingItem[] }> =
      AISLE_ORDER.filter(
        (aisle) => grouped[aisle] && grouped[aisle].length > 0
      ).map((aisle) => ({
        title: aisle,
        data: grouped[aisle],
      }));

    // Add any aisles not in the standard order
    Object.keys(grouped).forEach((aisle) => {
      if (!AISLE_ORDER.includes(aisle as Aisle)) {
        sections.push({
          title: aisle,
          data: grouped[aisle],
        });
      }
    });

    return sections;
  }, [shoppingItems, isPantryMode]);

  const addItem = () => {
    if (!newItemName.trim()) return;

    if (isPantryMode) {
      addPantryItem({
        name: newItemName.trim(),
        quantity: parseFloat(newItemQuantity) || 1,
        unit: newItemUnit.trim() || "item",
      });
    } else {
      const newItem: ShoppingItem = {
        id: `shopping-${Date.now()}-${Math.random()}`,
        name: newItemName.trim(),
        quantity: parseFloat(newItemQuantity) || 1,
        unit: newItemUnit.trim() || "item",
        isPurchased: false,
        aisle: getAisleForIngredient(newItemName.trim()),
      };
      addShoppingItems([newItem]);
    }

    setNewItemName("");
    setNewItemQuantity("");
    setNewItemUnit("");
    setShowAddForm(false);
  };

  const moveToPantry = (shoppingItem: ShoppingItem) => {
    moveFromShoppingList(shoppingItem);
    deleteShoppingItem(shoppingItem.id);
  };

  const moveToShoppingList = (pantryItem: PantryItem) => {
    const shoppingItem: ShoppingItem = {
      id: `shopping-${Date.now()}-${Math.random()}`,
      name: pantryItem.name,
      quantity: pantryItem.quantity,
      unit: pantryItem.unit,
      isPurchased: false,
      aisle: getAisleForIngredient(pantryItem.name),
    };
    addShoppingItems([shoppingItem]);
    deletePantryItem(pantryItem.id);
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    return (
      <View className="flex-row items-center bg-soft-beige rounded-xl px-4 py-3 mb-2 mx-4">
        {!isPantryMode && (
          <TouchableOpacity
            onPress={() => togglePurchased(item.id)}
            className="mr-3"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${
                item.isPurchased
                  ? "bg-dark-sage border-dark-sage"
                  : "border-charcoal-gray/30"
              }`}
            >
              {item.isPurchased && <Check size={16} color="#FAF9F7" />}
            </View>
          </TouchableOpacity>
        )}

        <View className="flex-1">
          <Text
            className={`text-base ${
              item.isPurchased && !isPantryMode
                ? "text-charcoal-gray/50 line-through"
                : "text-charcoal-gray font-semibold"
            }`}
          >
            {item.name}
          </Text>
          {!isPantryMode && (
            <Text className="text-sm text-charcoal-gray/60">
              {item.quantity} {item.unit}
            </Text>
          )}
        </View>

        {/* Move Button */}
        <TouchableOpacity
          onPress={() => {
            if (isPantryMode) {
              // Move from pantry to shopping list
              const pantryItem = pantryItems.find((p) => p.id === item.id);
              if (pantryItem) {
                moveToShoppingList(pantryItem);
              }
            } else {
              // Move from shopping list to pantry
              moveToPantry(item);
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            minWidth: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
            paddingHorizontal: 8,
          }}
          activeOpacity={0.7}
        >
          <View className="bg-dark-sage/10 rounded-lg px-2 py-2 flex-row items-center">
            {isPantryMode ? (
              <>
                <ArrowRight size={14} color="#5A6E6C" />
                <ShoppingBag
                  size={14}
                  color="#5A6E6C"
                  style={{ marginLeft: 4 }}
                />
              </>
            ) : (
              <>
                <ArrowRight size={14} color="#5A6E6C" />
                <Package size={14} color="#5A6E6C" style={{ marginLeft: 4 }} />
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          onPress={() => {
            if (isPantryMode) {
              const pantryItem = pantryItems.find((p) => p.id === item.id);
              if (pantryItem) {
                deletePantryItem(pantryItem.id);
              }
            } else {
              deleteShoppingItem(item.id);
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      {/* Header with Toggle */}
      <View className="px-6 py-4 border-b border-soft-beige">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-charcoal-gray">
            {isPantryMode ? "Pantry" : "Shopping List"}
          </Text>
        </View>

        {/* Toggle Button */}
        <View className="flex-row bg-soft-beige rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setIsPantryMode(false)}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${
              !isPantryMode ? "bg-dark-sage" : ""
            }`}
            activeOpacity={0.7}
            style={{ minHeight: 44 }}
          >
            <ShoppingBag
              size={18}
              color={!isPantryMode ? "#FAF9F7" : "#3E3E3E"}
              style={{ marginRight: 6 }}
            />
            <Text
              className={`font-semibold ${
                !isPantryMode ? "text-off-white" : "text-charcoal-gray"
              }`}
            >
              Shopping List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsPantryMode(true)}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center ${
              isPantryMode ? "bg-dark-sage" : ""
            }`}
            activeOpacity={0.7}
            style={{ minHeight: 44 }}
          >
            <Package
              size={18}
              color={isPantryMode ? "#FAF9F7" : "#3E3E3E"}
              style={{ marginRight: 6 }}
            />
            <Text
              className={`font-semibold ${
                isPantryMode ? "text-off-white" : "text-charcoal-gray"
              }`}
            >
              Pantry
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {isPantryMode ? (
        <FlatList
          data={currentItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 120 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-12 px-6">
              <Text className="text-charcoal-gray/60 text-base text-center">
                Your pantry is empty
              </Text>
              <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                Tap the + button to add items
              </Text>
            </View>
          }
        />
      ) : (
        <SectionList
          sections={groupedByAisle}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View className="px-4 py-3 bg-warm-sand/50">
              <Text className="text-charcoal-gray font-bold text-sm uppercase tracking-wide">
                {title}
              </Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-12 px-6">
              <Text className="text-charcoal-gray/60 text-base text-center">
                Your shopping list is empty
              </Text>
              <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                Tap the + button to add items
              </Text>
            </View>
          }
        />
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <View className="bg-soft-beige border-t border-warm-sand px-6 py-4">
          <View className="mb-3">
            <Text className="text-sm text-charcoal-gray mb-2 ml-1">
              Item Name
            </Text>
            <TextInput
              className="bg-off-white rounded-xl px-4 py-3 text-charcoal-gray text-base"
              placeholder="e.g., Sugar"
              placeholderTextColor="#9CA3AF"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
          </View>
          <View className="flex-row mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">
                Quantity
              </Text>
              <TextInput
                className="bg-off-white rounded-xl px-4 py-3 text-charcoal-gray text-base"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">Unit</Text>
              <TextInput
                className="bg-off-white rounded-xl px-4 py-3 text-charcoal-gray text-base"
                placeholder="cup"
                placeholderTextColor="#9CA3AF"
                value={newItemUnit}
                onChangeText={setNewItemUnit}
              />
            </View>
          </View>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => {
                setShowAddForm(false);
                setNewItemName("");
                setNewItemQuantity("");
                setNewItemUnit("");
              }}
              className="flex-1 bg-warm-sand rounded-xl py-3 items-center justify-center mr-2"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal-gray font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addItem}
              className="flex-1 bg-dark-sage rounded-xl py-3 items-center justify-center ml-2"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold">Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Add Button */}
      {!showAddForm && (
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          className="absolute bottom-6 right-6 bg-dark-sage rounded-full w-14 h-14 items-center justify-center shadow-lg"
          activeOpacity={0.8}
        >
          <Plus size={24} color="#FAF9F7" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

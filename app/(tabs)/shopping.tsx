import "@/nativewind-setup";
import { usePantryStore } from "@/src/store/usePantryStore";
import { useShoppingListStore } from "@/src/store/useShoppingListStore";
import { PantryItem, ShoppingItem } from "@/src/types";
import {
  AISLE_ORDER,
  Aisle,
  getAisleForIngredient,
} from "@/src/utils/aisleMapper";
import { formatQuantity } from "@/src/utils/fractionFormatter";
import { decodeHtmlEntities } from "@/src/utils/htmlDecoder";
import {
  ArrowRight,
  Check,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
  const clearShoppingList = useShoppingListStore((state) => state.clearAll);
  const clearPurchased = useShoppingListStore((state) => state.clearPurchased);

  const pantryItems = usePantryStore((state) => state.items);
  const addPantryItem = usePantryStore((state) => state.addItem);
  const deletePantryItem = usePantryStore((state) => state.deleteItem);
  const clearPantry = usePantryStore((state) => state.clearAll);
  const moveFromShoppingList = usePantryStore(
    (state) => state.moveFromShoppingList
  );

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Listen to keyboard events to adjust form position
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
  // Separate purchased items to show at the bottom
  const groupedByAisle = useMemo(() => {
    if (isPantryMode) return [];

    // Create a set of pantry item names (normalized) for quick lookup
    const pantryNames = new Set(
      pantryItems.map((item) => item.name.toLowerCase().trim())
    );

    // Filter out items that are in the pantry
    // Separate purchased and unpurchased items
    const unpurchasedItems = shoppingItems.filter(
      (item) =>
        !item.isPurchased && !pantryNames.has(item.name.toLowerCase().trim())
    );
    const purchasedItems = shoppingItems.filter(
      (item) =>
        item.isPurchased && !pantryNames.has(item.name.toLowerCase().trim())
    );

    // Group unpurchased items by aisle
    const grouped: Record<string, ShoppingItem[]> = {};

    unpurchasedItems.forEach((item) => {
      const aisle = item.aisle || getAisleForIngredient(item.name);
      if (!grouped[aisle]) {
        grouped[aisle] = [];
      }
      grouped[aisle].push({ ...item, aisle });
    });

    // Sort items within each aisle alphabetically
    Object.keys(grouped).forEach((aisle) => {
      grouped[aisle].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Create sections in aisle order (only for unpurchased items)
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

    // Add purchased items section at the bottom if there are any
    if (purchasedItems.length > 0) {
      sections.push({
        title: "Purchased",
        data: purchasedItems.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    return sections;
  }, [shoppingItems, isPantryMode, pantryItems]);

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

  const renderItem = ({
    item,
    index,
    section,
  }: {
    item: ShoppingItem;
    index?: number;
    section?: { data: ShoppingItem[] };
  }) => {
    // Only add top margin for first item in a section (shopping list mode with sections)
    const isFirstInSection = !isPantryMode && section && index === 0;
    return (
      <View
        className={`flex-row items-center bg-soft-beige rounded-xl px-4 py-3 mb-2 mx-4 ${
          isFirstInSection ? "mt-3" : ""
        }`}
      >
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
            {(() => {
              // Always display "eggs" (plural) for egg items, regardless of quantity
              const normalizedName = item.name.toLowerCase().trim();
              if (normalizedName === "egg") {
                // Preserve capitalization style from original name
                const isCapitalized =
                  item.name.length > 0 &&
                  item.name[0] === item.name[0].toUpperCase();
                return decodeHtmlEntities(isCapitalized ? "Eggs" : "eggs");
              }
              return decodeHtmlEntities(item.name);
            })()}
          </Text>
          {!isPantryMode &&
            (() => {
              // Only show quantity/unit if we have a valid quantity
              if (item.quantity === null || item.quantity === undefined)
                return null;

              const formattedQty = formatQuantity(item.quantity, item.unit);

              if (!formattedQty) return null;

              // Build the display string: "4 1/2 cups" (not "4 1/2" + " cups" separately)
              const displayText = item.unit
                ? `${formattedQty} ${item.unit}`
                : formattedQty;

              return (
                <Text className="text-sm text-charcoal-gray/60">
                  {displayText}
                </Text>
              );
            })()}
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
          <View
            className="bg-dark-sage/10 rounded-lg px-2 py-2 flex-row items-center"
            pointerEvents="none"
          >
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
          <X size={20} color="#9CA3AF" pointerEvents="none" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header with Toggle */}
        <View className="px-6 py-4 border-b border-soft-beige">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-charcoal-gray">
              {isPantryMode ? "Pantry" : "Shopping List"}
            </Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => {
                  if (showAddForm) {
                    setShowAddForm(false);
                    setNewItemName("");
                    setNewItemQuantity("");
                    setNewItemUnit("");
                  } else {
                    setShowAddForm(true);
                  }
                }}
                className="flex-row items-center rounded-lg px-3 py-2 bg-warm-sand"
                activeOpacity={0.7}
              >
                <Plus size={16} color="#5A6E6C" style={{ marginRight: 6 }} />
                <Text
                  className={`font-semibold text-sm ${
                    showAddForm ? "text-charcoal-gray" : "text-dark-sage"
                  }`}
                >
                  Add Item
                </Text>
              </TouchableOpacity>
              {currentItems.length > 0 && !showAddForm && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      `Clear ${isPantryMode ? "Pantry" : "Shopping List"}`,
                      `Are you sure you want to clear all items from your ${
                        isPantryMode ? "pantry" : "shopping list"
                      }? This action cannot be undone.`,
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                        {
                          text: "Clear All",
                          style: "destructive",
                          onPress: () => {
                            if (isPantryMode) {
                              clearPantry();
                            } else {
                              clearShoppingList();
                            }
                          },
                        },
                      ]
                    );
                  }}
                  className="flex-row items-center bg-charcoal-gray/10 rounded-lg px-3 py-2"
                  activeOpacity={0.7}
                >
                  <Trash2
                    size={16}
                    color="#3E3E3E"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-charcoal-gray font-semibold text-sm">
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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

        {/* Helper Text for Shopping List */}
        {!isPantryMode && groupedByAisle.length > 0 && (
          <View className="px-6 py-2 flex-row justify-center items-center">
            <Text className="text-xs text-charcoal-gray/50 text-center">
              Tap{" "}
            </Text>
            <Package
              size={12}
              color="#9CA3AF"
              style={{ marginHorizontal: 2 }}
            />
            <Text className="text-xs text-charcoal-gray/50 text-center">
              {" "}
              to mark items you already have
            </Text>
          </View>
        )}

        {/* Helper Text for Pantry */}
        {isPantryMode && currentItems.length > 0 && (
          <View className="px-6 pt-2 flex-row justify-center items-center">
            <Text className="text-xs text-charcoal-gray/50 text-center">
              Tap{" "}
            </Text>
            <ShoppingBag
              size={12}
              color="#9CA3AF"
              style={{ marginHorizontal: 2 }}
            />
            <Text className="text-xs text-charcoal-gray/50 text-center">
              {" "}
              to add items to your shopping list
            </Text>
          </View>
        )}

        {/* List */}
        {isPantryMode ? (
          <FlatList
            data={currentItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 80 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-12 px-6">
                <Text className="text-charcoal-gray/60 text-base text-center">
                  Your pantry is empty
                </Text>
                <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                  Tap "Add Item" to add items
                </Text>
              </View>
            }
          />
        ) : (
          <SectionList
            sections={groupedByAisle}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title, data } }) => {
              const isPurchasedSection = title === "Purchased";
              const purchasedCount = isPurchasedSection ? data.length : 0;

              return (
                <View className="px-4 py-3 bg-warm-sand/50">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-charcoal-gray font-bold text-sm uppercase tracking-wide">
                      {title}
                    </Text>
                    {isPurchasedSection && purchasedCount > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            "Clear Purchased Items",
                            `Are you sure you want to remove all ${purchasedCount} purchased item(s) from your shopping list?`,
                            [
                              {
                                text: "Cancel",
                                style: "cancel",
                              },
                              {
                                text: "Clear",
                                style: "destructive",
                                onPress: () => {
                                  clearPurchased();
                                },
                              },
                            ]
                          );
                        }}
                        className="bg-charcoal-gray/10 rounded-lg px-3 py-1.5"
                        activeOpacity={0.7}
                      >
                        <Text className="text-charcoal-gray font-semibold text-xs">
                          Clear All
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 80 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View className="items-center justify-center py-12 px-6">
                <Text className="text-charcoal-gray/60 text-base text-center">
                  Your shopping list is empty
                </Text>
                <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
                  Tap "Add Item" to add items
                </Text>
              </View>
            }
          />
        )}

        {/* Add Item Form */}
        {showAddForm && (
          <View
            className="bg-dark-sage border-t border-sage-green/30 px-6 py-4 absolute bottom-0 left-0 right-0"
            style={{
              paddingBottom:
                Platform.OS === "ios" ? Math.max(80, keyboardHeight) : 80,
              marginBottom: Platform.OS === "android" ? keyboardHeight : 0,
            }}
          >
            <View className="mb-3">
              <Text className="text-sm text-off-white mb-2 ml-1">
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
                <Text className="text-sm text-off-white mb-2 ml-1">
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
                <Text className="text-sm text-off-white mb-2 ml-1">Unit</Text>
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
                className="flex-1 bg-light-gray rounded-xl py-3 items-center justify-center mr-2 border border-off-white/30"
                activeOpacity={0.7}
              >
                <Text className="text-charcoal-gray font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addItem}
                className="flex-1 bg-warm-sand rounded-xl py-3 items-center justify-center ml-2"
                activeOpacity={0.7}
              >
                <Text className="text-charcoal-gray font-semibold">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

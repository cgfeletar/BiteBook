import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingItem } from '@/src/types';
import { Check, Plus, X } from 'lucide-react-native';

// Dummy shopping list data
const dummyShoppingItems: ShoppingItem[] = [
  { id: '1', name: 'Sugar', quantity: 1, unit: 'cup', isPurchased: false },
  { id: '2', name: 'Flour', quantity: 2, unit: 'cups', isPurchased: false },
  { id: '3', name: 'Eggs', quantity: 6, unit: 'large', isPurchased: true },
  { id: '4', name: 'Butter', quantity: 0.5, unit: 'cup', isPurchased: false },
];

const dummyPantryItems: ShoppingItem[] = [
  { id: 'p1', name: 'Olive Oil', quantity: 1, unit: 'bottle', isPurchased: false },
  { id: 'p2', name: 'Salt', quantity: 1, unit: 'container', isPurchased: false },
  { id: 'p3', name: 'Pepper', quantity: 1, unit: 'container', isPurchased: false },
];

export default function ShoppingListScreen() {
  const [isPantryMode, setIsPantryMode] = useState(false);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(dummyShoppingItems);
  const [pantryItems, setPantryItems] = useState<ShoppingItem[]>(dummyPantryItems);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const currentItems = isPantryMode ? pantryItems : shoppingItems;
  const setCurrentItems = isPantryMode ? setPantryItems : setShoppingItems;

  const togglePurchased = (id: string) => {
    setCurrentItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
      )
    );
  };

  const deleteItem = (id: string) => {
    setCurrentItems((items) => items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    if (!newItemName.trim()) return;

    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      quantity: parseFloat(newItemQuantity) || 1,
      unit: newItemUnit.trim() || 'item',
      isPurchased: false,
    };

    setCurrentItems((items) => [...items, newItem]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setShowAddForm(false);
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <View className="flex-row items-center bg-soft-beige rounded-xl px-4 py-3 mb-3 mx-4">
      <TouchableOpacity
        onPress={() => togglePurchased(item.id)}
        className="mr-3"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${
            item.isPurchased
              ? 'bg-sage-green border-sage-green'
              : 'border-charcoal-gray/30'
          }`}
        >
          {item.isPurchased && <Check size={16} color="#FAF9F7" />}
        </View>
      </TouchableOpacity>

      <View className="flex-1">
        <Text
          className={`text-base ${
            item.isPurchased
              ? 'text-charcoal-gray/50 line-through'
              : 'text-charcoal-gray font-semibold'
          }`}
        >
          {item.name}
        </Text>
        <Text className="text-sm text-charcoal-gray/60">
          {item.quantity} {item.unit}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => deleteItem(item.id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'bottom']}>
      {/* Header with Toggle */}
      <View className="px-6 py-4 border-b border-soft-beige">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-charcoal-gray">
            {isPantryMode ? 'Pantry' : 'Shopping List'}
          </Text>
        </View>

        {/* Toggle Button */}
        <View className="flex-row bg-soft-beige rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setIsPantryMode(false)}
            className={`flex-1 py-2 rounded-lg items-center ${
              !isPantryMode ? 'bg-sage-green' : ''
            }`}
            activeOpacity={0.7}
            style={{ minHeight: 44 }}
          >
            <Text
              className={`font-semibold ${
                !isPantryMode ? 'text-off-white' : 'text-charcoal-gray'
              }`}
            >
              Shopping List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsPantryMode(true)}
            className={`flex-1 py-2 rounded-lg items-center ${
              isPantryMode ? 'bg-sage-green' : ''
            }`}
            activeOpacity={0.7}
            style={{ minHeight: 44 }}
          >
            <Text
              className={`font-semibold ${
                isPantryMode ? 'text-off-white' : 'text-charcoal-gray'
              }`}
            >
              Pantry
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={currentItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 120 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12 px-6">
            <Text className="text-charcoal-gray/60 text-base text-center">
              {isPantryMode
                ? 'Your pantry is empty'
                : 'Your shopping list is empty'}
            </Text>
            <Text className="text-charcoal-gray/40 text-sm text-center mt-2">
              Tap the + button to add items
            </Text>
          </View>
        }
      />

      {/* Add Item Form */}
      {showAddForm && (
        <View className="bg-soft-beige border-t border-warm-sand px-6 py-4">
          <View className="mb-3">
            <Text className="text-sm text-charcoal-gray mb-2 ml-1">Item Name</Text>
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
              <Text className="text-sm text-charcoal-gray mb-2 ml-1">Quantity</Text>
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
                setNewItemName('');
                setNewItemQuantity('');
                setNewItemUnit('');
              }}
              className="flex-1 bg-warm-sand rounded-xl py-3 items-center justify-center mr-2"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal-gray font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addItem}
              className="flex-1 bg-sage-green rounded-xl py-3 items-center justify-center ml-2"
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
          className="absolute bottom-6 right-6 bg-sage-green rounded-full w-14 h-14 items-center justify-center shadow-lg"
          activeOpacity={0.8}
        >
          <Plus size={24} color="#FAF9F7" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}


import { View, Text, TextInput, ScrollView, FlatList, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, User } from 'lucide-react-native';
import { RecipeCard } from '@/components/RecipeCard';
import { Recipe } from '@/src/types';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';

// Dummy recipe data matching the Recipe interface
const dummyRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Creamy Mushroom Pasta',
    coverImage: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400',
    ingredients: [
      { name: 'Pasta', quantity: 400, unit: 'g', isChecked: false },
      { name: 'Mushrooms', quantity: 300, unit: 'g', isChecked: false },
      { name: 'Heavy Cream', quantity: 200, unit: 'ml', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Cook pasta according to package directions', isCompleted: false, isBeginnerFriendly: true },
      { id: '2', instruction: 'Sauté mushrooms until golden', isCompleted: false, isBeginnerFriendly: true },
      { id: '3', instruction: 'Add cream and simmer', isCompleted: false, isBeginnerFriendly: true },
    ],
    nutritionalInfo: {
      calories: 450,
      protein: 15,
      carbohydrates: 60,
      fat: 18,
    },
    sourceUrl: 'https://example.com/recipe1',
    originalAuthor: 'Chef John',
    tags: ['pasta', 'vegetarian', 'comfort-food'],
    categoryIds: ['cat1', 'cat2'],
    createdAt: Timestamp.now(),
  },
  {
    id: '2',
    title: 'Classic Chocolate Chip Cookies',
    coverImage: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400',
    ingredients: [
      { name: 'Flour', quantity: 2.5, unit: 'cups', isChecked: false },
      { name: 'Butter', quantity: 1, unit: 'cup', isChecked: false },
      { name: 'Chocolate Chips', quantity: 2, unit: 'cups', isChecked: false },
      { name: 'Sugar', quantity: 0.75, unit: 'cup', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Cream butter and sugars together', isCompleted: false, isBeginnerFriendly: true },
      { id: '2', instruction: 'Mix in eggs and vanilla', isCompleted: false, isBeginnerFriendly: true },
      { id: '3', instruction: 'Bake at 375°F for 10-12 minutes', isCompleted: false, isBeginnerFriendly: true, timerDuration: 660 },
    ],
    nutritionalInfo: {
      calories: 120,
      protein: 1.5,
      carbohydrates: 16,
      fat: 6,
    },
    sourceUrl: 'https://example.com/recipe2',
    originalAuthor: 'Grandma\'s Recipe',
    tags: ['dessert', 'baking', 'sweet'],
    categoryIds: ['cat3'],
    createdAt: Timestamp.now(),
  },
  {
    id: '3',
    title: 'Mediterranean Quinoa Bowl',
    coverImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
    ingredients: [
      { name: 'Quinoa', quantity: 1, unit: 'cup', isChecked: false },
      { name: 'Cherry Tomatoes', quantity: 200, unit: 'g', isChecked: false },
      { name: 'Cucumber', quantity: 1, unit: 'medium', isChecked: false },
      { name: 'Feta Cheese', quantity: 100, unit: 'g', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Cook quinoa and let cool', isCompleted: false, isBeginnerFriendly: true },
      { id: '2', instruction: 'Dice vegetables', isCompleted: false, isBeginnerFriendly: true },
      { id: '3', instruction: 'Toss everything together with olive oil', isCompleted: false, isBeginnerFriendly: true },
    ],
    nutritionalInfo: {
      calories: 320,
      protein: 12,
      carbohydrates: 45,
      fat: 10,
      fiber: 6,
    },
    sourceUrl: 'https://example.com/recipe3',
    originalAuthor: 'Healthy Eats',
    tags: ['healthy', 'vegetarian', 'mediterranean'],
    categoryIds: ['cat1', 'cat4'],
    createdAt: Timestamp.now(),
  },
  {
    id: '4',
    title: 'Spicy Thai Green Curry',
    coverImage: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
    ingredients: [
      { name: 'Chicken', quantity: 500, unit: 'g', isChecked: false },
      { name: 'Green Curry Paste', quantity: 3, unit: 'tbsp', isChecked: false },
      { name: 'Coconut Milk', quantity: 400, unit: 'ml', isChecked: false },
      { name: 'Thai Basil', quantity: 1, unit: 'cup', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Heat curry paste in a pan', isCompleted: false, isBeginnerFriendly: false },
      { id: '2', instruction: 'Add coconut milk and bring to a simmer', isCompleted: false, isBeginnerFriendly: true },
      { id: '3', instruction: 'Add chicken and cook until done', isCompleted: false, isBeginnerFriendly: true },
    ],
    nutritionalInfo: {
      calories: 380,
      protein: 28,
      carbohydrates: 12,
      fat: 24,
    },
    sourceUrl: 'https://example.com/recipe4',
    originalAuthor: 'Thai Kitchen',
    tags: ['thai', 'spicy', 'curry'],
    categoryIds: ['cat2'],
    createdAt: Timestamp.now(),
  },
  {
    id: '5',
    title: 'Avocado Toast with Poached Eggs',
    coverImage: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400',
    ingredients: [
      { name: 'Sourdough Bread', quantity: 2, unit: 'slices', isChecked: false },
      { name: 'Avocado', quantity: 1, unit: 'large', isChecked: false },
      { name: 'Eggs', quantity: 2, unit: 'large', isChecked: false },
      { name: 'Red Pepper Flakes', quantity: 1, unit: 'pinch', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Toast bread until golden', isCompleted: false, isBeginnerFriendly: true },
      { id: '2', instruction: 'Mash avocado with lemon and salt', isCompleted: false, isBeginnerFriendly: true },
      { id: '3', instruction: 'Poach eggs in simmering water', isCompleted: false, isBeginnerFriendly: false, timerDuration: 180 },
    ],
    nutritionalInfo: {
      calories: 420,
      protein: 18,
      carbohydrates: 35,
      fat: 22,
    },
    sourceUrl: 'https://example.com/recipe5',
    originalAuthor: 'Brunch Lover',
    tags: ['breakfast', 'brunch', 'healthy'],
    categoryIds: ['cat1'],
    createdAt: Timestamp.now(),
  },
  {
    id: '6',
    title: 'Beef Bourguignon',
    coverImage: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
    ingredients: [
      { name: 'Beef Chuck', quantity: 1.5, unit: 'kg', isChecked: false },
      { name: 'Red Wine', quantity: 750, unit: 'ml', isChecked: false },
      { name: 'Carrots', quantity: 3, unit: 'large', isChecked: false },
      { name: 'Onions', quantity: 2, unit: 'medium', isChecked: false },
    ],
    steps: [
      { id: '1', instruction: 'Marinate beef in wine overnight', isCompleted: false, isBeginnerFriendly: false },
      { id: '2', instruction: 'Brown beef in a Dutch oven', isCompleted: false, isBeginnerFriendly: false },
      { id: '3', instruction: 'Slow cook for 3 hours', isCompleted: false, isBeginnerFriendly: true, timerDuration: 10800 },
    ],
    nutritionalInfo: {
      calories: 520,
      protein: 42,
      carbohydrates: 15,
      fat: 28,
    },
    sourceUrl: 'https://example.com/recipe6',
    originalAuthor: 'Julia Child',
    tags: ['french', 'comfort-food', 'slow-cooked'],
    categoryIds: ['cat2'],
    createdAt: Timestamp.now(),
  },
];

const categories = ['All', 'Breakfast', 'Vegan', 'Italian'];

export default function RecipeFeed() {
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Determine number of columns based on screen width
  const isTablet = width >= 768;
  const numColumns = isTablet ? (width >= 1024 ? 4 : 3) : 2;

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleRecipePress = (recipe: Recipe) => {
    // TODO: Navigate to recipe detail screen
    console.log('Pressed recipe:', recipe.id);
  };

  const handleFavoritePress = (recipeId: string) => {
    // TODO: Implement favorite functionality
    console.log('Favorite toggled for recipe:', recipeId);
  };

  // Calculate item width for grid layout
  const itemWidth = (width - 24 - (numColumns - 1) * 12) / numColumns; // 24 = horizontal padding (12*2), 12 = gap between items

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={['top', 'bottom']}>
      <View className="flex-1">
        {/* Header Row */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
          <Text className="text-2xl font-bold text-charcoal">Good Morning!</Text>
          <TouchableOpacity
            className="bg-warm-sand rounded-full w-10 h-10 items-center justify-center"
            activeOpacity={0.7}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <User size={20} color="#3E3E3E" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-6 mb-4">
          <View className="bg-white rounded-xl flex-row items-center px-4 py-3 shadow-sm">
            <Search size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-charcoal text-base"
              placeholder="Search recipes..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Category Chips */}
        <View className="mb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          >
            {categories.map((category) => {
              const isActive = category === activeCategory;
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 ${
                    isActive ? 'bg-charcoal' : 'bg-white border border-stone-100'
                  }`}
                  activeOpacity={0.7}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text
                    className={`font-semibold text-sm ${
                      isActive ? 'text-white' : 'text-charcoal'
                    }`}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Content - Recipe Grid */}
        <FlatList
          data={dummyRecipes}
          numColumns={numColumns}
          renderItem={({ item, index }) => {
            const isLastInRow = (index + 1) % numColumns === 0;
            return (
              <View 
                style={{ 
                  width: itemWidth, 
                  marginRight: isLastInRow ? 12 : 12, 
                  marginBottom: 12,
                }}
              >
                <RecipeCard
                  recipe={item}
                  onPress={() => handleRecipePress(item)}
                  onFavoritePress={() => handleFavoritePress(item.id)}
                />
              </View>
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C7D2C0"
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

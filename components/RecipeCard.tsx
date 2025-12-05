import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { Recipe } from '@/src/types';
import { useState } from 'react';

interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
}

export function RecipeCard({ recipe, onPress, onFavoritePress, isFavorite = false }: RecipeCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);

  const handleFavoritePress = () => {
    setFavorite(!favorite);
    onFavoritePress?.();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="mb-3"
    >
      <View className="bg-soft-beige rounded-xl overflow-hidden shadow-sm">
        {/* Cover Image */}
        <Image
          source={{ uri: recipe.coverImage }}
          style={{ width: '100%', aspectRatio: 0.85 }}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
        />
        
        {/* Content Overlay */}
        <View className="p-3">
          {/* Title and Favorite Button */}
          <View className="flex-row items-start justify-between">
            <Text 
              className="text-charcoal-gray font-semibold text-sm flex-1 mr-2"
              numberOfLines={2}
            >
              {recipe.title}
            </Text>
            <TouchableOpacity
              onPress={handleFavoritePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Heart
                size={18}
                color={favorite ? '#D7B4B3' : '#9CA3AF'}
                fill={favorite ? '#D7B4B3' : 'none'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}


import { Plus, X } from "lucide-react-native";
import React, { useState } from "react";
import {
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";

interface TagsSectionProps {
  originalTags: string[];
  customTags: string[];
  onRemoveCustomTag: (tag: string) => void;
  onAddCustomTag: (tag: string) => void;
}

export function TagsSection({
  originalTags,
  customTags,
  onRemoveCustomTag,
  onAddCustomTag,
}: TagsSectionProps) {
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag) {
      onAddCustomTag(trimmedTag);
      setNewTag("");
      setShowAddTagInput(false);
    }
  };

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-charcoal-gray">Tags</Text>
        <RNTouchableOpacity
          onPress={() => {
            setShowAddTagInput(!showAddTagInput);
            if (!showAddTagInput) setNewTag("");
          }}
          className="bg-dark-sage rounded-full px-4 py-2 flex-row items-center"
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FAF9F7" style={{ marginRight: 6 }} />
          <Text className="text-off-white text-sm font-semibold">
            {showAddTagInput ? "Cancel" : "Add Custom"}
          </Text>
        </RNTouchableOpacity>
      </View>

      {/* Tags display */}
      {(originalTags.length > 0 || customTags.length > 0) && (
        <View className="mb-4">
          <View className="flex-row flex-wrap">
            {originalTags.map((tag, index) => (
              <View
                key={index}
                className="bg-warm-sand rounded-full px-4 py-2 mr-2 mb-2"
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text className="text-charcoal-gray text-sm">{tag}</Text>
              </View>
            ))}
            {customTags.map((tag, index) => (
              <RNTouchableOpacity
                key={index}
                onPress={() => onRemoveCustomTag(tag)}
                className="bg-warm-sand rounded-full px-4 py-2 mr-2 mb-2 flex-row items-center"
                activeOpacity={0.7}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text className="text-charcoal-gray text-sm mr-2">{tag}</Text>
                <X size={14} color="#3E3E3E" pointerEvents="none" />
              </RNTouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Add Custom Tag Input */}
      {showAddTagInput && (
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-soft-beige rounded-xl px-4 py-3 text-charcoal-gray text-base"
            placeholder="Ex: Grandma's Recipe"
            placeholderTextColor="#9CA3AF"
            value={newTag}
            onChangeText={setNewTag}
            onSubmitEditing={handleAddTag}
            returnKeyType="done"
            style={{ minHeight: 44 }}
            autoFocus
          />
          <RNTouchableOpacity
            onPress={handleAddTag}
            className="bg-dark-sage rounded-xl px-6 py-3 items-center justify-center"
            activeOpacity={0.8}
            style={{ minHeight: 44 }}
            disabled={!newTag.trim()}
          >
            <Text className="text-off-white text-base font-semibold">Add</Text>
          </RNTouchableOpacity>
        </View>
      )}
    </View>
  );
}

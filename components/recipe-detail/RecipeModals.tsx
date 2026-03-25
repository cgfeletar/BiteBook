import { decodeHtmlEntities } from "@/src/utils/htmlDecoder";
import {
  BookOpen,
  Calendar,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import React from "react";
import {
  FlatList,
  Modal,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";

interface MenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onAddToCalendar: () => void;
  onDelete: () => void;
}

export function MenuModal({
  visible,
  onClose,
  onShare,
  onAddToCalendar,
  onDelete,
}: MenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <RNTouchableOpacity
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          className="bg-off-white rounded-2xl p-4"
          style={{ width: "80%", maxWidth: 300 }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-charcoal-gray">
              Recipe Options
            </Text>
            <RNTouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#3E3E3E" />
            </RNTouchableOpacity>
          </View>

          <RNTouchableOpacity
            onPress={onShare}
            className="flex-row items-center py-4 border-b border-soft-beige"
            activeOpacity={0.7}
          >
            <Share2 size={20} color="#5A6E6C" style={{ marginRight: 12 }} />
            <Text className="text-charcoal-gray text-base font-semibold">
              Share Recipe
            </Text>
          </RNTouchableOpacity>

          <RNTouchableOpacity
            onPress={onAddToCalendar}
            className="flex-row items-center py-4 border-b border-soft-beige"
            activeOpacity={0.7}
          >
            <Calendar size={20} color="#5A6E6C" style={{ marginRight: 12 }} />
            <Text className="text-charcoal-gray text-base font-semibold">
              Add to Calendar
            </Text>
          </RNTouchableOpacity>

          <RNTouchableOpacity
            onPress={onDelete}
            className="flex-row items-center py-4"
            activeOpacity={0.7}
          >
            <Trash2 size={20} color="#DC2626" style={{ marginRight: 12 }} />
            <Text className="text-red-600 text-base font-semibold">
              Delete Recipe
            </Text>
          </RNTouchableOpacity>
        </View>
      </RNTouchableOpacity>
    </Modal>
  );
}

interface BookSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  books: { id: string; name: string; description?: string }[];
  onSelectBook: (bookId: string) => void;
}

export function BookSelectorModal({
  visible,
  onClose,
  books,
  onSelectBook,
}: BookSelectorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          className="bg-off-white rounded-t-3xl"
          style={{ maxHeight: "70%", paddingBottom: 40 }}
        >
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-soft-beige">
            <Text className="text-xl font-bold text-charcoal-gray">
              Select a Book
            </Text>
            <RNTouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#3E3E3E" pointerEvents="none" />
            </RNTouchableOpacity>
          </View>

          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
              <RNTouchableOpacity
                onPress={() => onSelectBook(item.id)}
                className="flex-row items-center px-6 py-4 border-b border-soft-beige"
                activeOpacity={0.7}
              >
                <BookOpen
                  size={20}
                  color="#5A6E6C"
                  style={{ marginRight: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-charcoal-gray text-base font-semibold">
                    {decodeHtmlEntities(item.name)}
                  </Text>
                  {item.description && (
                    <Text className="text-charcoal-gray/60 text-sm mt-1">
                      {item.description}
                    </Text>
                  )}
                </View>
              </RNTouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="px-6 py-8 items-center">
                <Text className="text-charcoal-gray/60 text-base">
                  No recipe books yet
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

interface TimerExtensionModalProps {
  visible: boolean;
  customMinutes: string;
  onCustomMinutesChange: (text: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function TimerExtensionModal({
  visible,
  customMinutes,
  onCustomMinutesChange,
  onConfirm,
  onClose,
}: TimerExtensionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-off-white rounded-xl p-6 w-full max-w-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-charcoal-gray">
              Add Custom Time
            </Text>
            <RNTouchableOpacity
              onPress={onClose}
              className="w-11 h-11 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <X size={20} color="#3E3E3E" pointerEvents="none" />
            </RNTouchableOpacity>
          </View>
          <Text className="text-charcoal-gray/70 text-sm mb-4">
            Enter the number of minutes to add to the timer:
          </Text>
          <TextInput
            value={customMinutes}
            onChangeText={onCustomMinutesChange}
            placeholder="e.g., 15"
            keyboardType="number-pad"
            className="bg-white border border-warm-sand rounded-lg px-4 py-3 text-charcoal-gray text-base mb-4"
            autoFocus
          />
          <View className="flex-row gap-3">
            <RNTouchableOpacity
              onPress={onClose}
              className="flex-1 bg-soft-beige rounded-lg py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal-gray font-semibold">Cancel</Text>
            </RNTouchableOpacity>
            <RNTouchableOpacity
              onPress={onConfirm}
              className="flex-1 bg-dark-sage rounded-lg py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold">Add Time</Text>
            </RNTouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

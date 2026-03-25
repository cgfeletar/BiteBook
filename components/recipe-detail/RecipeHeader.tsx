import { RecipeCreateInput } from "@/src/types";
import { HEADER_HEIGHT, MIN_HEADER_HEIGHT } from "@/src/utils/recipeDetailUtils";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  MoreVertical,
  Pencil,
  X,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  Linking,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

interface RecipeHeaderProps {
  recipeData: RecipeCreateInput;
  scrollY: SharedValue<number>;
  missingFields: string[];
  isEditingTitle: boolean;
  editedTitle: string;
  onEditedTitleChange: (text: string) => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onMenuPress: () => void;
}

export function RecipeHeader({
  recipeData,
  scrollY,
  missingFields,
  isEditingTitle,
  editedTitle,
  onEditedTitleChange,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onMenuPress,
}: RecipeHeaderProps) {
  const headerImageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.2, 1],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, -(HEADER_HEIGHT - MIN_HEADER_HEIGHT)],
      Extrapolate.CLAMP
    );
    return { transform: [{ scale }, { translateY }] };
  });

  const headerOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, 1],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const headerContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [1, 0],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
      [0, -20],
      Extrapolate.CLAMP
    );
    return { opacity, transform: [{ translateY }] };
  });

  const hasId = "id" in recipeData && recipeData.id;
  const title = (recipeData.title || "Untitled Recipe").slice(0, 40);

  return (
    <>
      {/* Fixed Header Bar (appears on scroll) */}
      <SafeAreaView
        className="absolute top-0 left-0 right-0 z-10"
        edges={["top"]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            headerOverlayStyle,
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: "#FAF9F7",
            },
          ]}
          pointerEvents="box-none"
        >
          <RNTouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#3E3E3E" pointerEvents="none" />
          </RNTouchableOpacity>
          <Text
            className="text-lg font-bold text-charcoal-gray ml-4 flex-1"
            numberOfLines={1}
            style={{ fontFamily: "Lora_700Bold" }}
          >
            {title}
          </Text>
          <RNTouchableOpacity
            onPress={onMenuPress}
            hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
            activeOpacity={0.7}
          >
            <MoreVertical size={24} color="#3E3E3E" pointerEvents="none" />
          </RNTouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      {/* Collapsible Header Image */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HEIGHT,
            overflow: "hidden",
          },
          headerImageStyle,
        ]}
      >
        {recipeData.coverImage ? (
          <Image
            source={{ uri: recipeData.coverImage }}
            style={{ width: "100%", height: HEADER_HEIGHT }}
            contentFit="cover"
            transition={200}
            placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
          />
        ) : (
          <View className="bg-soft-beige w-full h-full items-center justify-center">
            <Text className="text-charcoal-gray/50">No Image</Text>
          </View>
        )}

        {/* Header Content Overlay */}
        <View
          className="absolute top-0 left-0 right-0 bottom-0"
          style={{ zIndex: 10, justifyContent: "flex-end" }}
        >
          {/* Navigation buttons at top */}
          <SafeAreaView
            edges={["top"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          >
            <View className="flex-row items-center justify-between w-full px-4">
              <RNTouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: "rgba(231, 216, 201, 0.8)",
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={20} color="#3E3E3E" pointerEvents="none" />
              </RNTouchableOpacity>

              <RNTouchableOpacity
                onPress={onMenuPress}
                hitSlop={{ top: 22, bottom: 22, left: 22, right: 22 }}
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: "rgba(231, 216, 201, 0.8)",
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.7}
              >
                <MoreVertical
                  size={20}
                  color="#3E3E3E"
                  pointerEvents="none"
                />
              </RNTouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Title and Author overlay */}
          <Animated.View
            style={[
              headerContentStyle,
              {
                backgroundColor: "rgba(231, 216, 201, 0.8)",
                paddingHorizontal: 24,
                paddingBottom: 12,
                paddingTop: 12,
              },
            ]}
          >
            <View className="flex-row items-center mb-2">
              {isEditingTitle ? (
                <View className="flex-1 flex-row items-center">
                  <TextInput
                    value={editedTitle}
                    onChangeText={(text) => {
                      if (text.length <= 40) onEditedTitleChange(text);
                    }}
                    maxLength={40}
                    className="flex-1 text-3xl font-bold text-charcoal-gray"
                    style={{ fontFamily: "Lora_700Bold" }}
                    autoFocus
                    onSubmitEditing={onSaveTitle}
                    onBlur={onSaveTitle}
                  />
                  <RNTouchableOpacity
                    onPress={onSaveTitle}
                    className="ml-2 p-2"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Check size={20} color="#5A6E6C" />
                  </RNTouchableOpacity>
                  <RNTouchableOpacity
                    onPress={onCancelEditTitle}
                    className="ml-1 p-2"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color="#5A6E6C" pointerEvents="none" />
                  </RNTouchableOpacity>
                </View>
              ) : (
                <>
                  <View className="flex-1">
                    <Text
                      className={`text-3xl font-bold flex-1 ${
                        missingFields.includes("title")
                          ? "text-dusty-rose"
                          : "text-charcoal-gray"
                      }`}
                      numberOfLines={2}
                      style={{ fontFamily: "Lora_700Bold" }}
                    >
                      {title}
                    </Text>
                    {missingFields.includes("title") && (
                      <Text className="text-xs text-dusty-rose mt-1">
                        Missing title - please edit
                      </Text>
                    )}
                  </View>
                  {hasId && (
                    <RNTouchableOpacity
                      onPress={onStartEditTitle}
                      className="ml-2 p-2"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Pencil size={20} color="#5A6E6C" pointerEvents="none" />
                    </RNTouchableOpacity>
                  )}
                </>
              )}
            </View>
            <View className="flex flex-row items-center justify-between">
              {recipeData.originalAuthor ? (
                <Text className="text-base text-charcoal-gray/90">
                  By {recipeData.originalAuthor}
                </Text>
              ) : (
                <View />
              )}
              {recipeData.sourceUrl ? (
                <RNTouchableOpacity
                  onPress={async () => {
                    try {
                      const url = recipeData.sourceUrl;
                      const canOpen = await Linking.canOpenURL(url);
                      if (canOpen) {
                        await Linking.openURL(url);
                      }
                    } catch {
                      Alert.alert("Error", "Could not open the recipe URL");
                    }
                  }}
                  className="flex-row items-center"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text className="text-base text-charcoal-gray/90 mr-1">
                    Original Recipe
                  </Text>
                  <ExternalLink size={16} color="#5A6E6C" />
                </RNTouchableOpacity>
              ) : (
                <View />
              )}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}

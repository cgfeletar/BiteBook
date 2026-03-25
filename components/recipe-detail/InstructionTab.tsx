import { TimerState } from "@/src/hooks/useRecipeTimers";
import { Recipe, RecipeCreateInput, Step } from "@/src/types";
import {
  enrichInstructionWithAmounts,
  parseTimeFromInstruction,
} from "@/src/utils/recipeDetailUtils";
import {
  Check,
  ChefHat,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  X,
} from "lucide-react-native";
import React, { useRef } from "react";
import {
  Alert,
  TouchableOpacity as RNTouchableOpacity,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

interface InstructionTabProps {
  recipeData: RecipeCreateInput;
  missingFields: string[];
  completedSteps: Set<string>;
  onStepComplete: (stepId: string) => void;
  // Timer
  timerStates: Record<string, TimerState>;
  onStartTimer: (stepId: string, duration: number) => void;
  onPauseTimer: (stepId: string, step: Step) => void;
  onResumeTimer: (stepId: string, step: Step) => void;
  onResetTimer: (stepId: string, step: Step) => void;
  onDismissTimer: (stepId: string) => void;
  onOpenTimerExtension: (stepId: string) => void;
  // Edit mode
  canEdit: boolean;
  isEditing: boolean;
  editedSteps: Step[];
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddStep: () => void;
  onDeleteStep: (stepId: string) => void;
  onUpdateStep: (
    stepId: string,
    field: keyof Step,
    value: string | number | boolean | undefined
  ) => void;
  // Mark as cooked
  onMarkAsCooked: () => void;
}

export function InstructionTab({
  recipeData,
  missingFields,
  completedSteps,
  onStepComplete,
  timerStates,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onDismissTimer,
  onOpenTimerExtension,
  canEdit,
  isEditing,
  editedSteps,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddStep,
  onDeleteStep,
  onUpdateStep,
  onMarkAsCooked,
}: InstructionTabProps) {
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const handleStepComplete = (stepId: string) => {
    onStepComplete(stepId);
    const swipeable = swipeableRefs.current[stepId];
    if (swipeable) {
      setTimeout(() => swipeable.close(), 1000);
    }
  };

  const renderSwipeRightAction = (isCompleted: boolean) => (
    <View
      className="bg-dark-sage rounded-xl items-center justify-center px-6 mb-4"
      style={{ justifyContent: "center", alignItems: "center", width: 80 }}
    >
      <View className="items-center">
        <Check size={24} color="#FAF9F7" />
        <Text className="text-off-white text-xs">
          {isCompleted ? "Done" : "Undo"}
        </Text>
      </View>
    </View>
  );

  const renderTimer = (step: Step) => {
    const parsedDuration =
      step.timerDuration || parseTimeFromInstruction(step.instruction);
    if (!parsedDuration) return null;

    const timerState = timerStates[step.id] || {
      remaining: parsedDuration,
      isRunning: false,
      isCompleted: false,
      isDismissed: false,
    };

    const minutes = Math.floor(timerState.remaining / 60);
    const seconds = timerState.remaining % 60;
    const timeDisplay = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    return (
      <View className="mt-3 -mx-2 bg-white rounded-lg px-3 py-3 border border-warm-sand/50">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {!timerState.isCompleted && !timerState.isDismissed && (
              <Clock size={16} color="#5A6E6C" style={{ marginRight: 8 }} />
            )}
            <Text className="text-charcoal-gray font-semibold text-base">
              {timerState.isDismissed ? "Done" : timeDisplay}
            </Text>
          </View>

          {!timerState.isCompleted && !timerState.isDismissed && (
            <View className="flex-row items-center gap-2">
              {timerState.isRunning ? (
                <RNTouchableOpacity
                  onPress={() => onPauseTimer(step.id, step)}
                  className="bg-warm-sand rounded-lg w-10 h-10 items-center justify-center"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Pause size={16} color="#3E3E3E" pointerEvents="none" />
                </RNTouchableOpacity>
              ) : (
                <RNTouchableOpacity
                  onPress={() => onResumeTimer(step.id, step)}
                  className="bg-dark-sage rounded-lg w-10 h-10 items-center justify-center"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Play size={16} color="#FAF9F7" pointerEvents="none" />
                </RNTouchableOpacity>
              )}

              <RNTouchableOpacity
                onPress={() => onResetTimer(step.id, step)}
                className="bg-soft-beige rounded-lg px-3 py-1.5"
                activeOpacity={0.7}
              >
                <Text className="text-charcoal-gray text-sm font-semibold">
                  Reset
                </Text>
              </RNTouchableOpacity>
            </View>
          )}

          {timerState.isCompleted && (
            <View className="mt-2">
              <View className="bg-dark-sage/20 rounded-lg px-3 py-2 mb-2">
                <Text className="text-dark-sage text-xs font-semibold mb-2">
                  Timer Complete! Add more time?
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[1, 2, 5, 10].map((mins) => (
                    <RNTouchableOpacity
                      key={mins}
                      onPress={() => onStartTimer(step.id, mins * 60)}
                      className="bg-dark-sage rounded-lg px-3 py-1.5"
                      activeOpacity={0.7}
                    >
                      <Text className="text-off-white text-xs font-semibold">
                        +{mins}m
                      </Text>
                    </RNTouchableOpacity>
                  ))}
                  <RNTouchableOpacity
                    onPress={() => onOpenTimerExtension(step.id)}
                    className="bg-warm-sand rounded-lg px-3 py-1.5"
                    activeOpacity={0.7}
                  >
                    <Text className="text-charcoal-gray text-xs font-semibold">
                      Custom
                    </Text>
                  </RNTouchableOpacity>
                  <RNTouchableOpacity
                    onPress={() => onDismissTimer(step.id)}
                    className="bg-soft-beige rounded-lg px-3 py-1.5"
                    activeOpacity={0.7}
                  >
                    <Text className="text-charcoal-gray text-xs font-semibold">
                      Done
                    </Text>
                  </RNTouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      className={
        missingFields.includes("steps")
          ? "border-2 border-dusty-rose rounded-xl p-4"
          : ""
      }
    >
      {/* Edit Mode Header */}
      {isEditing ? (
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-charcoal-gray">
            Edit Instructions
          </Text>
          <View className="flex-row gap-2">
            <RNTouchableOpacity
              onPress={onCancelEdit}
              className="bg-warm-sand rounded-lg px-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-charcoal-gray font-semibold">Cancel</Text>
            </RNTouchableOpacity>
            <RNTouchableOpacity
              onPress={onSaveEdit}
              className="bg-dark-sage rounded-lg px-4 py-2"
              activeOpacity={0.7}
            >
              <Text className="text-off-white font-semibold">Save</Text>
            </RNTouchableOpacity>
          </View>
        </View>
      ) : (
        canEdit && (
          <View className="mb-4 flex-row items-center justify-end">
            <RNTouchableOpacity
              onPress={onStartEdit}
              className="flex-row items-center bg-soft-beige rounded-lg px-3 py-2"
              activeOpacity={0.7}
            >
              <Pencil size={16} color="#5A6E6C" />
              <Text className="text-dark-sage font-semibold ml-2">Edit</Text>
            </RNTouchableOpacity>
          </View>
        )
      )}

      {/* Edit Mode: Editable steps */}
      {isEditing ? (
        <>
          {editedSteps.map((step, index) => (
            <View
              key={step.id}
              className="mb-4 bg-soft-beige rounded-xl px-4 py-4"
            >
              <View className="flex-row items-start mb-3">
                <View className="rounded-full w-10 h-10 items-center justify-center mr-4 mt-1 bg-dark-sage">
                  <Text className="text-off-white font-bold text-base">
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <TextInput
                    value={step.title || ""}
                    onChangeText={(text) =>
                      onUpdateStep(step.id, "title", text || undefined)
                    }
                    placeholder="Step title (optional)"
                    placeholderTextColor="#6B7280"
                    className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-base mb-2"
                    style={{ fontFamily: "Lora_700" }}
                  />
                  <TextInput
                    value={step.instruction}
                    onChangeText={(text) =>
                      onUpdateStep(step.id, "instruction", text)
                    }
                    placeholder="Enter instruction..."
                    className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-base min-h-[80px]"
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 80 }}
                  />
                  <View className="mt-2 flex-row items-center">
                    <Text className="text-sm text-charcoal-gray/60 mr-2">
                      Timer (minutes):
                    </Text>
                    <TextInput
                      value={
                        step.timerDuration
                          ? Math.round(step.timerDuration / 60).toString()
                          : ""
                      }
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        onUpdateStep(
                          step.id,
                          "timerDuration",
                          text === ""
                            ? undefined
                            : isNaN(num)
                            ? undefined
                            : num * 60
                        );
                      }}
                      placeholder="Optional"
                      placeholderTextColor="#6B7280"
                      className="bg-white rounded-lg px-3 py-2 text-charcoal-gray text-sm flex-1"
                      keyboardType="number-pad"
                      style={{ maxWidth: 120 }}
                    />
                  </View>
                </View>
                <RNTouchableOpacity
                  onPress={() => onDeleteStep(step.id)}
                  className="ml-2 w-10 h-10 items-center justify-center"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#D7B4B3" pointerEvents="none" />
                </RNTouchableOpacity>
              </View>
            </View>
          ))}
          <RNTouchableOpacity
            onPress={onAddStep}
            className="bg-dark-sage rounded-xl py-3 px-4 flex-row items-center justify-center mb-4"
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FAF9F7" />
            <Text className="text-off-white font-semibold ml-2">Add Step</Text>
          </RNTouchableOpacity>
        </>
      ) : (
        <>
          {/* Missing Steps Message */}
          {missingFields.includes("steps") &&
            recipeData.steps.length === 0 && (
              <View className="mb-6 bg-dusty-rose/10 border border-dusty-rose rounded-xl p-4">
                <Text className="text-dusty-rose font-semibold mb-1">
                  ⚠️ Instructions not detected
                </Text>
                <Text className="text-charcoal-gray/70 text-sm">
                  We couldn't extract instructions from the image. Please add
                  them manually using the Edit button.
                </Text>
              </View>
            )}

          {recipeData.steps.map((step, index) => {
            const isCompleted = completedSteps.has(step.id);
            return (
              <Swipeable
                key={step.id}
                ref={(ref) => {
                  if (ref) swipeableRefs.current[step.id] = ref;
                }}
                renderRightActions={() => renderSwipeRightAction(isCompleted)}
                onSwipeableWillOpen={() => handleStepComplete(step.id)}
                overshootRight={false}
                friction={2}
              >
                <View
                  className={`mb-4 rounded-xl px-4 py-4 ${
                    isCompleted
                      ? "bg-dark-sage/30 border-2 border-dark-sage"
                      : "bg-soft-beige"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {step.title && (
                    <View className="mb-3">
                      <Text className="text-lg font-bold text-dark-sage">
                        {step.title}
                      </Text>
                    </View>
                  )}

                  <View className="flex-row items-start">
                    <View
                      className={`rounded-full w-10 h-10 items-center justify-center mr-4 mt-1 ${
                        isCompleted ? "bg-dark-sage" : "bg-dark-sage"
                      }`}
                    >
                      {isCompleted ? (
                        <Check size={20} color="#FAF9F7" />
                      ) : (
                        <Text className="text-off-white font-bold text-base">
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-base leading-6 ${
                          isCompleted
                            ? "text-charcoal-gray/60 line-through"
                            : "text-charcoal-gray"
                        }`}
                      >
                        {enrichInstructionWithAmounts(
                          step.instruction,
                          recipeData.ingredients
                        )}
                      </Text>
                      {renderTimer(step)}
                    </View>
                  </View>
                </View>
              </Swipeable>
            );
          })}
        </>
      )}

      {/* Mark as Cooked Button */}
      <RNTouchableOpacity
        onPress={onMarkAsCooked}
        className="bg-dark-sage rounded-xl py-4 px-6 items-center justify-center mt-6 mb-6"
        activeOpacity={0.8}
      >
        <View className="flex-row items-center">
          <ChefHat size={20} color="#FAF9F7" style={{ marginRight: 8 }} />
          <Text className="text-off-white text-base font-semibold">
            Mark as Cooked
          </Text>
        </View>
      </RNTouchableOpacity>
    </View>
  );
}

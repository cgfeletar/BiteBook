import { parseTimeFromInstruction } from "@/src/utils/recipeDetailUtils";
import { Step } from "@/src/types";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";

export interface TimerState {
  remaining: number;
  isRunning: boolean;
  isCompleted: boolean;
  isDismissed?: boolean;
}

export function useRecipeTimers(steps: Step[] | undefined) {
  const [timerStates, setTimerStates] = useState<Record<string, TimerState>>(
    {}
  );
  const timerIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>(
    {}
  );
  const [timerExtensionStepId, setTimerExtensionStepId] = useState<
    string | null
  >(null);
  const [customMinutes, setCustomMinutes] = useState("");

  // Initialize timer states when steps load
  useEffect(() => {
    if (!steps) return;

    const initialStates: Record<string, TimerState> = {};
    steps.forEach((step) => {
      const duration =
        step.timerDuration || parseTimeFromInstruction(step.instruction);
      if (duration) {
        initialStates[step.id] = {
          remaining: duration,
          isRunning: false,
          isCompleted: false,
          isDismissed: false,
        };
      }
    });

    setTimerStates(initialStates);

    return () => {
      Object.values(timerIntervals.current).forEach((interval) => {
        clearInterval(interval);
      });
      Object.keys(timerIntervals.current).forEach((key) => {
        delete timerIntervals.current[key];
      });
    };
  }, [steps]);

  // Configure notifications
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  const startTimer = async (stepId: string, duration: number) => {
    if (duration <= 0) return;

    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: duration,
        isRunning: true,
        isCompleted: false,
        isDismissed: false,
      },
    }));

    // Schedule notification asynchronously
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        const minutes = Math.round(duration / 60);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Timer Complete!",
            body: `Your BiteBook timer for ${minutes} minute${
              minutes !== 1 ? "s" : ""
            } is done`,
            sound: true,
          },
          trigger: {
            type: "timeInterval",
            seconds: duration,
            repeats: false,
          } as any,
        });
      } catch {
        // Continue with timer even if notification fails
      }
    })();

    // Start interval
    timerIntervals.current[stepId] = setInterval(() => {
      setTimerStates((prev) => {
        const current = prev[stepId];
        if (!current) return prev;

        if (current.remaining <= 1) {
          clearInterval(timerIntervals.current[stepId]);
          delete timerIntervals.current[stepId];
          return {
            ...prev,
            [stepId]: {
              remaining: 0,
              isRunning: false,
              isCompleted: true,
              isDismissed: false,
            },
          };
        }

        return {
          ...prev,
          [stepId]: {
            ...current,
            remaining: current.remaining - 1,
          },
        };
      });
    }, 1000);
  };

  const pauseTimer = (stepId: string, step: Step) => {
    if (timerIntervals.current[stepId]) {
      clearInterval(timerIntervals.current[stepId]);
      delete timerIntervals.current[stepId];
    }
    const duration =
      step.timerDuration ||
      parseTimeFromInstruction(step.instruction) ||
      0;
    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: prev[stepId]?.remaining || duration,
        isRunning: false,
        isCompleted: prev[stepId]?.isCompleted || false,
      },
    }));
  };

  const resumeTimer = async (stepId: string, step: Step) => {
    const duration =
      step.timerDuration ||
      parseTimeFromInstruction(step.instruction) ||
      0;
    const currentRemaining = timerStates[stepId]?.remaining || duration;

    if (currentRemaining <= 0) return;

    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: currentRemaining,
        isRunning: true,
        isCompleted: false,
      },
    }));

    // Schedule notification
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        const minutes = Math.round(currentRemaining / 60);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Timer Complete!",
            body: `Your BiteBook timer for ${minutes} minute${
              minutes !== 1 ? "s" : ""
            } is done`,
            sound: true,
          },
          trigger: {
            type: "timeInterval",
            seconds: currentRemaining,
            repeats: false,
          } as any,
        });
      } catch {
        // Continue with timer even if notification fails
      }
    })();

    timerIntervals.current[stepId] = setInterval(() => {
      setTimerStates((prev) => {
        const current = prev[stepId];
        if (!current) return prev;

        if (current.remaining <= 1) {
          clearInterval(timerIntervals.current[stepId]);
          delete timerIntervals.current[stepId];
          return {
            ...prev,
            [stepId]: {
              remaining: 0,
              isRunning: false,
              isCompleted: true,
            },
          };
        }

        return {
          ...prev,
          [stepId]: {
            ...current,
            remaining: current.remaining - 1,
          },
        };
      });
    }, 1000);
  };

  const resetTimer = (stepId: string, step: Step) => {
    if (timerIntervals.current[stepId]) {
      clearInterval(timerIntervals.current[stepId]);
      delete timerIntervals.current[stepId];
    }
    const duration =
      step.timerDuration ||
      parseTimeFromInstruction(step.instruction) ||
      0;
    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: duration,
        isRunning: false,
        isCompleted: false,
      },
    }));
    Notifications.cancelAllScheduledNotificationsAsync();
  };

  const dismissTimer = (stepId: string) => {
    if (timerIntervals.current[stepId]) {
      clearInterval(timerIntervals.current[stepId]);
      delete timerIntervals.current[stepId];
    }
    Notifications.cancelAllScheduledNotificationsAsync();
    setTimerStates((prev) => ({
      ...prev,
      [stepId]: {
        remaining: 0,
        isRunning: false,
        isCompleted: false,
        isDismissed: true,
      },
    }));
  };

  const handleCustomTimeExtension = () => {
    const minutes = parseFloat(customMinutes);
    if (!isNaN(minutes) && minutes > 0 && timerExtensionStepId) {
      const additionalSeconds = Math.round(minutes * 60);
      startTimer(timerExtensionStepId, additionalSeconds);
      setTimerExtensionStepId(null);
      setCustomMinutes("");
    }
  };

  const closeTimerExtension = () => {
    setTimerExtensionStepId(null);
    setCustomMinutes("");
  };

  return {
    timerStates,
    timerExtensionStepId,
    customMinutes,
    setTimerExtensionStepId,
    setCustomMinutes,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    dismissTimer,
    handleCustomTimeExtension,
    closeTimerExtension,
  };
}

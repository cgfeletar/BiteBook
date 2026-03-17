import { useAuthStore } from "@/src/store/useAuthStore";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ArrowLeft, Mail, Send } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Support email - update this with your Google Console support email
const SUPPORT_EMAIL = "support@bitebookhq.app"; // TODO: Replace with your actual support email

export default function FeedbackScreen() {
  const { user } = useAuthStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendFeedback = async () => {
    if (!message.trim()) {
      Alert.alert("Required", "Please enter your feedback or question.");
      return;
    }

    setIsSending(true);

    try {
      // Create email subject
      const emailSubject = subject.trim()
        ? `[BiteBook Feedback] ${subject.trim()}`
        : "[BiteBook Feedback] User Feedback";

      // Create email body with user info
      const emailBody = `Hello,

${message.trim()}

---
Sent from BiteBook App
${user?.email ? `User: ${user.email}` : ""}
${user?.displayName ? `Name: ${user.displayName}` : ""}
`;

      // Create mailto link
      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        emailSubject,
      )}&body=${encodeURIComponent(emailBody)}`;

      // Check if device can handle mailto links
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        // Clear form after successful send
        setSubject("");
        setMessage("");
        Alert.alert(
          "Feedback Sent",
          "Thank you for your feedback! We'll get back to you soon.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        Alert.alert(
          "Email Not Available",
          "Please configure an email account on your device to send feedback.",
        );
      }
    } catch (error) {
      console.error("Error sending feedback:", error);
      Alert.alert(
        "Error",
        "Failed to open email app. Please try again or contact us directly.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-off-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-11 h-11 items-center justify-center"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#3E3E3E" pointerEvents="none" />
          </TouchableOpacity>
          <Text
            className="text-2xl font-bold text-charcoal flex-1 ml-4"
            style={{ fontFamily: "Lora_700Bold" }}
          >
            Send Feedback
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-4">
            {/* Info Card */}
            <View className="bg-soft-beige rounded-xl p-4 mb-6 flex-row items-start">
              <View className="mr-3 mt-0.5">
                <Mail size={20} color="#5A6E6C" />
              </View>
              <View className="flex-1">
                <Text className="text-charcoal font-semibold text-sm mb-1">
                  We'd love to hear from you!
                </Text>
                <Text className="text-charcoal/70 text-xs">
                  Share your feedback, report a bug, or ask a question. Your
                  message will be sent to our support team.
                </Text>
              </View>
            </View>

            {/* Subject Input */}
            <View className="mb-4">
              <Text className="text-charcoal font-semibold text-sm mb-2">
                Subject (Optional)
              </Text>
              <TextInput
                className="bg-white rounded-xl px-4 py-3 text-charcoal text-base border border-warm-sand/50"
                placeholder="Brief description of your feedback"
                placeholderTextColor="#9CA3AF"
                value={subject}
                onChangeText={setSubject}
                maxLength={100}
              />
            </View>

            {/* Message Input */}
            <View className="mb-6">
              <Text className="text-charcoal font-semibold text-sm mb-2">
                Message <Text className="text-redwood">*</Text>
              </Text>
              <TextInput
                className="bg-white rounded-xl px-4 py-4 text-charcoal text-base border border-warm-sand/50"
                placeholder="Tell us what's on your mind..."
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                style={{ minHeight: 160 }}
                maxLength={2000}
              />
              <Text className="text-charcoal/50 text-xs mt-2 text-right">
                {message.length}/2000
              </Text>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              onPress={handleSendFeedback}
              disabled={isSending || !message.trim()}
              className={`rounded-xl p-4 flex-row items-center justify-center ${
                isSending || !message.trim()
                  ? "bg-warm-sand/50"
                  : "bg-dark-sage"
              }`}
              activeOpacity={0.7}
            >
              <Send
                size={20}
                color={isSending || !message.trim() ? "#9CA3AF" : "#FAF9F7"}
              />
              <Text
                className={`font-semibold text-base ml-2 ${
                  isSending || !message.trim()
                    ? "text-charcoal/50"
                    : "text-off-white"
                }`}
              >
                {isSending ? "Sending..." : "Send Feedback"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

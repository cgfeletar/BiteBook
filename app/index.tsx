import { Redirect } from "expo-router";

export default function Index() {
  // Always land users on your main UI
  return <Redirect href="/(tabs)" />;
}

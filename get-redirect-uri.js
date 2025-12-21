// Quick script to get your exact redirect URI
// Run with: node get-redirect-uri.js

// Note: This requires the expo-auth-session package
// If this doesn't work, use the TypeScript version in your app instead

try {
  const AuthSession = require("expo-auth-session");
  const redirectUri = AuthSession.makeRedirectUri();
  console.log("\n✅ Your redirect URI is:");
  console.log(redirectUri);
  console.log(
    "\n📋 Copy this exact URI and add it to your Google OAuth Web client's authorized redirect URIs.\n"
  );
} catch (error) {
  console.log("\n❌ Could not determine redirect URI automatically.");
  console.log("\nInstead, add this to your login screen temporarily:");
  console.log(`
import * as AuthSession from "expo-auth-session";
console.log("Redirect URI:", AuthSession.makeRedirectUri());
  `);
  console.log("\nThen check your app logs/console when you run it.\n");
}

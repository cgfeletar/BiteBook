import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { Platform } from "react-native";
import { auth } from "../config/firebase";

// Complete web browser authentication
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Google using OAuth
 * Note: This requires Google OAuth to be configured in Firebase Console
 * and the appropriate client IDs to be set in environment variables
 *
 * IMPORTANT: When using useProxy: true, you MUST use the WEB client ID,
 * not the iOS/Android client IDs. The redirect URI must also be added
 * to the Web OAuth client's authorized redirect URIs in Google Cloud Console.
 */
export async function signInWithGoogleCredential(
  idToken: string
): Promise<void> {
  if (!idToken) {
    throw new Error("Missing Google ID token");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

/**
 * Sign in with Apple (iOS only)
 */
export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign-In is only available on iOS");
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, authorizationCode } = credential;

  if (!identityToken) {
    throw new Error("Apple Sign-In failed: No identity token");
  }

  const provider = new OAuthProvider("apple.com");
  const appleCredential = provider.credential({
    idToken: identityToken,
    rawNonce: authorizationCode || undefined,
  });

  await signInWithCredential(auth, appleCredential);
}

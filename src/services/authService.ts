import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
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
export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error(
      "Google sign-in on web requires popup/redirect implementation"
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: undefined,
    useProxy: true,
  });

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
  }

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  const request = new AuthSession.AuthRequest({
    clientId: webClientId,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    redirectUri,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery, {
    useProxy: true,
  });

  if (result.type !== "success" || !result.params.code) {
    throw new Error("Google sign-in failed or cancelled");
  }

  // 🔑 Firebase handles code exchange internally
  const credential = GoogleAuthProvider.credential(null, result.params.code);
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

import {
  AuthRequest,
  AuthRequestPromptOptions,
  AuthSessionResult,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect } from "react";
import { signInWithGoogleCredential } from "./authService";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  promptAsync: (
    options?: AuthRequestPromptOptions
  ) => Promise<AuthSessionResult>;
  request: AuthRequest | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (request) {
      console.log("🔵 [AuthProvider] Google OAuth request ready");
      console.log("🔵 [AuthProvider] Request URL:", (request as any)?.url);
      // Extract redirect URI from request URL if available
      try {
        const requestUrl = (request as any)?.url || "";
        if (requestUrl) {
          const urlObj = new URL(requestUrl);
          const redirectFromUrl = urlObj.searchParams.get("redirect_uri");
          if (redirectFromUrl) {
            console.log(
              "🔗 [AuthProvider] Redirect URI from request:",
              redirectFromUrl
            );
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === "success") {
      const { idToken } = response.authentication ?? {};

      if (!idToken) {
        console.error("Missing ID token from Google");
        return;
      }

      signInWithGoogleCredential(idToken);
    }
  }, [response]);

  return (
    <AuthContext.Provider value={{ promptAsync, request }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

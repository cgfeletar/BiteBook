# Authentication Setup Guide

This guide will walk you through setting up Google and Apple OAuth authentication for your Recipo app.

## Table of Contents

1. [Google Sign-In Setup](#google-sign-in-setup)
2. [Apple Sign-In Setup](#apple-sign-in-setup)
3. [Environment Variables](#environment-variables)
4. [Testing](#testing)

---

## Google Sign-In Setup

### Step 1: Enable Google Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Google** provider
5. Toggle **Enable** to ON
6. Enter your **Project support email** (usually your email)
7. Click **Save**

### Step 2: Get Google OAuth Client IDs

You need to create OAuth 2.0 credentials in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (or the linked Google Cloud project)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**

#### For iOS:

1. Select **iOS** as the application type
2. Enter a name (e.g., "Recipo iOS")
3. Enter your **Bundle ID** (found in `app.json` or Xcode project settings)
   - For Expo: Usually `com.yourcompany.saute` or similar
   - You can find it by running: `npx expo config --type introspect` and looking for `ios.bundleIdentifier`
4. Click **Create**
5. **Copy the Client ID** - this is your `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

#### For Android:

1. Select **Android** as the application type
2. Enter a name (e.g., "Recipo Android")
3. Enter your **Package name** (found in `app.json` or Android project)
   - For Expo: Usually `com.yourcompany.saute` or similar
4. Enter your **SHA-1 certificate fingerprint**:

   ```bash
   # For development (debug keystore)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # Or for Expo Go, you can get it from:
   npx expo run:android --variant debug
   ```

5. Click **Create**
6. **Copy the Client ID** - this is your `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

#### For Web (optional, if you plan to support web):

1. Select **Web application** as the application type
2. Enter a name (e.g., "Recipo Web")
3. Under **Authorized redirect URIs**, add:
   - `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
   - `http://localhost:19006` (for local development)
4. Click **Create**
5. **Copy the Client ID** - this is your `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### Step 3: Configure OAuth Redirect URIs

The redirect URIs are automatically handled by Expo's auth session proxy, but you may need to add them:

1. In Google Cloud Console, go to your **Web application** OAuth client
2. Under **Authorized redirect URIs**, add:

   ```
   https://auth.expo.io/@your-expo-username/saute
   ```

   (Replace `your-expo-username` with your Expo username)

3. For local development, also add:
   ```
   http://localhost:19006
   exp://localhost:19000
   ```

**Note:** Expo's `expo-auth-session` uses a proxy service, so the redirect URI is automatically generated. The format is typically:

```
https://auth.expo.io/@[username]/[slug]
```

---

## Apple Sign-In Setup

### Step 1: Enable Apple Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Apple** provider
5. Toggle **Enable** to ON
6. Enter your **Apple Services ID** (see Step 2)
7. Enter your **Apple Team ID** (found in Apple Developer account)
8. Click **Save**

### Step 2: Configure Apple Sign-In in Apple Developer

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Identifiers** → **Services IDs**
4. Click **+** to create a new Services ID (or use existing)
5. Enter a **Description** (e.g., "Recipo Authentication")
6. Enter an **Identifier** (e.g., `com.yourcompany.saute.auth`)
7. Check **Sign in with Apple**
8. Click **Configure**
9. Under **Primary App ID**, select your app's Bundle ID
10. Under **Website URLs**, add:
    - **Domains and Subdomains**: `auth.expo.io`
    - **Return URLs**: `https://auth.expo.io/@your-expo-username/saute`
11. Click **Save** → **Continue** → **Register**
12. **Copy the Services ID** - this is what you'll use in Firebase

### Step 3: Enable Sign in with Apple in Xcode

1. Open your iOS project in Xcode (or run `npx expo prebuild` to generate native folders)
2. Select your project in the navigator
3. Select your app target
4. Go to **Signing & Capabilities** tab
5. Click **+ Capability**
6. Add **Sign in with Apple**
7. Build and run your app

---

## Environment Variables

### Step 1: Create `.env` file

Create a `.env` file in the root of your project (it's already in `.gitignore`):

```bash
# Firebase Configuration (you should already have these)
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id_here
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id_here
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id_here
```

### Step 2: Find Your Bundle ID / Package Name

To find your app's bundle identifier:

```bash
# Run this command in your project root
npx expo config --type introspect
```

Look for:

- `ios.bundleIdentifier` - this is your iOS Bundle ID
- `android.package` - this is your Android Package Name

Or check your `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.saute"
    },
    "android": {
      "package": "com.yourcompany.saute"
    }
  }
}
```

### Step 3: Restart Your Development Server

After adding environment variables:

```bash
# Stop your current server (Ctrl+C)
# Then restart
npx expo start --clear
```

---

## Quick Reference: Where to Find IDs

### Google Client IDs

- **Location**: [Google Cloud Console](https://console.cloud.google.com/) → Your Project → **APIs & Services** → **Credentials**
- **What to look for**: OAuth 2.0 Client IDs (separate ones for iOS, Android, Web)
- **Format**: Usually looks like `123456789-abcdefghijklmnop.apps.googleusercontent.com`

### Apple Services ID

- **Location**: [Apple Developer Portal](https://developer.apple.com/account/) → **Certificates, Identifiers & Profiles** → **Identifiers** → **Services IDs**
- **What to look for**: The identifier you created for Sign in with Apple
- **Format**: Usually looks like `com.yourcompany.saute.auth`

### Apple Team ID

- **Location**: [Apple Developer Portal](https://developer.apple.com/account/) → Top right corner, under your name
- **What to look for**: "Team ID" or "Membership" section
- **Format**: Usually 10 characters, like `ABC123DEFG`

### Bundle ID / Package Name

- **Location**: Your `app.json` file or run `npx expo config`
- **iOS**: `ios.bundleIdentifier`
- **Android**: `android.package`

---

## Testing

### Test Google Sign-In

1. Make sure your `.env` file has the correct client IDs
2. Restart your Expo dev server: `npx expo start --clear`
3. Run on a device or simulator:
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```
4. Navigate to the login screen
5. Tap "Continue with Google"
6. You should see the Google sign-in flow

### Test Apple Sign-In (iOS only)

1. Make sure Apple Sign-In is enabled in Firebase Console
2. Make sure the capability is added in Xcode
3. Run on an iOS device or simulator:
   ```bash
   npx expo run:ios
   ```
4. Navigate to the login screen
5. You should see the "Sign in with Apple" button
6. Tap it to test the flow

### Common Issues

**Issue**: "Google sign-in was cancelled"

- **Solution**: Make sure the client IDs match your app's bundle ID/package name

**Issue**: "Apple Sign-In button doesn't appear"

- **Solution**:
  - Make sure you're testing on iOS
  - Check that `isAppleAvailable` is true (the component checks this automatically)
  - Make sure Sign in with Apple capability is added in Xcode

**Issue**: "Redirect URI mismatch"

- **Solution**:
  - For Google: Add the Expo proxy URL to authorized redirect URIs
  - For Apple: Make sure the return URL matches what's in Apple Developer Portal

**Issue**: Environment variables not loading

- **Solution**:
  - Make sure the file is named `.env` (not `.env.local` or similar)
  - Restart your dev server with `--clear` flag
  - Make sure variables start with `EXPO_PUBLIC_`

---

## Next Steps

Once authentication is set up:

1. ✅ Users can sign in with Email/Password, Google, or Apple
2. ✅ User documents are automatically created in Firestore
3. ✅ Auth state persists across app restarts
4. ✅ Users are prompted to sign in when importing/saving recipes

For production deployment, make sure to:

- Use production OAuth client IDs
- Configure production redirect URIs
- Test on physical devices
- Set up proper error handling and user feedback

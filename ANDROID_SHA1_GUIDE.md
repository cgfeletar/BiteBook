# Getting Android SHA-1 Certificate Fingerprint

## The Problem

You're getting this error because Android SDK isn't installed. But **good news**: For Expo apps, you have easier options!

## Solution Options

### Option 1: Use Expo Development Build (Easiest - Recommended)

If you're using Expo development builds, you **don't need the SHA-1** for Google Sign-In to work during development. The OAuth flow will work without it.

**Just skip the SHA-1 for now** and:
1. Create the Android OAuth client in Google Cloud Console
2. Leave SHA-1 blank or use a placeholder
3. Test Google Sign-In - it should work!

### Option 2: Get SHA-1 from Expo (If You Have Android Studio)

If you have Android Studio installed, you can get the SHA-1:

```bash
# For debug keystore (development)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Look for the line that says:
```
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

### Option 3: Get SHA-1 from Expo Go (If Using Expo Go)

If you're using Expo Go app, the SHA-1 is already configured by Expo. You can find it:

1. Go to [Expo Dashboard](https://expo.dev)
2. Select your project
3. Go to **Credentials** → **Android**
4. You'll see the SHA-1 fingerprint there

### Option 4: Generate Development Build and Get SHA-1

If you create a development build, Expo will generate credentials:

```bash
# This will create native folders and you can get SHA-1
npx expo prebuild
npx expo run:android
```

But this requires Android Studio to be installed.

### Option 5: Use Google Sign-In Without SHA-1 (For Development)

**For development/testing purposes**, Google Sign-In can work without SHA-1 if you:
1. Create the Android OAuth client
2. Don't add SHA-1 (or add a placeholder)
3. Test in development build or Expo Go

The SHA-1 is mainly required for **production builds** and **release versions**.

---

## Recommended Approach for You

Since you're in development:

### Step 1: Create Android OAuth Client (Without SHA-1)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
4. Select **Android**
5. Enter:
   - **Name**: "Saute Android"
   - **Package name**: `com.saute.app`
   - **SHA-1 certificate fingerprint**: **Leave blank for now** (or enter `00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00` as placeholder)
6. Click **Create**
7. Copy the **Client ID** → this is your `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

### Step 2: Test Google Sign-In

Try Google Sign-In in your app. It should work for development!

### Step 3: Add SHA-1 Later (When Needed)

When you're ready to create a production build or need the actual SHA-1:

1. **If using Expo managed workflow**: Get it from Expo Dashboard
2. **If using bare workflow**: Use the keytool command above
3. **If using EAS Build**: EAS will generate it automatically

Then update the OAuth client in Google Cloud Console with the real SHA-1.

---

## Quick Fix: Install Android Studio (If You Want)

If you want to get the SHA-1 now, you can install Android Studio:

1. Download [Android Studio](https://developer.android.com/studio)
2. Install it
3. Open Android Studio → **More Actions** → **SDK Manager**
4. Install Android SDK
5. Then run the keytool command above

But **this isn't necessary** for development - you can skip SHA-1 for now!

---

## Summary

**For Development:**
- ✅ Create Android OAuth client without SHA-1 (or with placeholder)
- ✅ Google Sign-In will work in development builds
- ✅ Test your app

**For Production:**
- ⏸️ Get real SHA-1 from Expo Dashboard or keytool
- ⏸️ Update OAuth client with real SHA-1
- ⏸️ Create production build

**My Recommendation:** Skip SHA-1 for now, create the OAuth client, and test Google Sign-In. Add the real SHA-1 later when you're ready for production!


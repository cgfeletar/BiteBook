# Universal Links (iOS) & App Links (Android) Setup Guide

This guide will help you set up Universal Links for iOS and App Links for Android so that `https://saute.app/invite/*` links open your app directly.

## Overview

- **iOS Universal Links**: Requires an `apple-app-site-association` file on your website
- **Android App Links**: Requires an `assetlinks.json` file on your website
- **App Configuration**: Update `app.json` with associated domains and intent filters

---

## Step 1: Update app.json Configuration

The `app.json` has been updated with the necessary configuration. You'll need to:

1. **Get your Apple App ID** (for iOS):

   - Go to [Apple Developer Portal](https://developer.apple.com/account/)
   - Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**
   - Find your App ID (e.g., `com.saute.app`)
   - Copy the **Team ID** (found in the top right of the Apple Developer portal)

2. **Get your SHA-256 fingerprint** (for Android):

   ```bash
   # For release keystore
   keytool -list -v -keystore your-release-key.keystore -alias your-key-alias

   # For debug keystore (development)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   Look for the **SHA-256** value in the output.

---

## Step 2: Set Up Your Website

You need to host two files on `https://saute.app`:

### File 1: `/.well-known/apple-app-site-association` (iOS)

**Location**: `https://saute.app/.well-known/apple-app-site-association`

**Content** (replace `YOUR_TEAM_ID` and `com.saute.app`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.com.saute.app",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

**Important Notes**:

- File must be served with `Content-Type: application/json` (NOT `text/plain`)
- File must be accessible via HTTPS
- No file extension (no `.json`)
- Must be served from the root domain (`saute.app`, not `www.saute.app`)

### File 2: `/.well-known/assetlinks.json` (Android)

**Location**: `https://saute.app/.well-known/assetlinks.json`

**Content** (replace `YOUR_SHA256_FINGERPRINT`):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.saute.app",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

**Important Notes**:

- File must be served with `Content-Type: application/json`
- File must be accessible via HTTPS
- Must be served from the root domain

---

## Step 3: Hosting Options

### Option A: Static Hosting (Recommended for Simple Setup)

If you're using a static hosting service (Vercel, Netlify, GitHub Pages, etc.):

1. Create a `.well-known` folder in your website's public directory
2. Add both files (no extensions)
3. Configure your hosting to serve them with correct Content-Type

**Example for Vercel** (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/.well-known/apple-app-site-association",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    {
      "source": "/.well-known/assetlinks.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        }
      ]
    }
  ]
}
```

**Example for Netlify** (`netlify.toml`):

```toml
[[headers]]
  for = "/.well-known/apple-app-site-association"
  [headers.values]
    Content-Type = "application/json"

[[headers]]
  for = "/.well-known/assetlinks.json"
  [headers.values]
    Content-Type = "application/json"
```

### Option B: Custom Server

If you have a custom server, ensure:

- Files are served with correct Content-Type headers
- Files are accessible without authentication
- HTTPS is enabled

---

## Step 4: Verify Files Are Accessible

Test that your files are accessible:

```bash
# Test iOS file
curl -I https://saute.app/.well-known/apple-app-site-association

# Should return:
# Content-Type: application/json

# Test Android file
curl -I https://saute.app/.well-known/assetlinks.json

# Should return:
# Content-Type: application/json
```

**iOS Validation Tool**: https://search.developer.apple.com/appsearch-validation-tool/

- Enter: `https://saute.app/invite/test123`
- It will validate your AASA file

**Android Validation Tool**: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://saute.app&relation=delegate_permission/common.handle_all_urls

---

## Step 5: Update app.json (Already Done)

The `app.json` has been updated with:

- `ios.associatedDomains` for Universal Links
- `android.intentFilters` for App Links

After updating with your Team ID and SHA-256, rebuild your app:

```bash
npx expo prebuild --clean
npx expo run:ios
npx expo run:android
```

---

## Step 6: Test Universal Links

### iOS Testing:

1. Build and install the app on a device
2. Send yourself a link: `https://saute.app/invite/test123`
3. Open the link in Safari (not in-app browser)
4. The app should open automatically

**Note**: Universal Links only work when:

- Link is opened in Safari (not Chrome or other browsers)
- Link is not opened in an in-app browser
- App is installed on the device

### Android Testing:

1. Build and install the app on a device
2. Send yourself a link: `https://saute.app/invite/test123`
3. Open the link in any browser or app
4. The app should open automatically (you may see a dialog asking which app to use)

---

## Troubleshooting

### iOS Issues:

1. **Links open in Safari instead of app**:

   - Make sure the AASA file is served with `Content-Type: application/json`
   - Verify the file is accessible via HTTPS
   - Check that the Team ID and Bundle ID match exactly
   - Try deleting and reinstalling the app (iOS caches AASA files)

2. **"Universal Links not working"**:
   - Use Apple's validation tool: https://search.developer.apple.com/appsearch-validation-tool/
   - Check that paths match: `/invite/*` in AASA matches your links

### Android Issues:

1. **Links open in browser instead of app**:

   - Verify `assetlinks.json` is accessible
   - Check SHA-256 fingerprint matches exactly (no colons, uppercase)
   - Ensure package name matches exactly
   - Try clearing app data and reinstalling

2. **"App Links not verified"**:
   - Use Google's validation tool: https://digitalassetlinks.googleapis.com/v1/statements:list
   - Check that the SHA-256 is correct (debug vs release keystore)

---

## Alternative: Use Expo's Built-in Hosting (EAS)

If you don't have a website yet, you can use Expo's hosting:

1. The files will be hosted at `https://saute.app` (your Expo project domain)
2. Expo automatically serves the AASA and assetlinks files
3. You still need to configure `app.json` as shown above

---

## Next Steps

1. ✅ Update `app.json` with your Team ID and SHA-256
2. ✅ Set up your website and host the association files
3. ✅ Verify files are accessible
4. ✅ Rebuild and test the app
5. ✅ Test Universal Links on real devices

Once set up, all `https://saute.app/invite/*` links will automatically open your app!

---

This was the info from the side cursor on Sunday:
Summary

1. Updated app.json
   Added ios.associatedDomains for Universal Links
   Added android.intentFilters for App Links
2. Created setup guide
   UNIVERSAL_LINKS_SETUP.md — step-by-step instructions
3. Created example files
   website-association-files/apple-app-site-association.example — iOS file template
   website-association-files/assetlinks.json.example — Android file template
   website-association-files/README.md — quick reference
   Quick start
   Get your values:
   Apple Team ID: from Apple Developer Portal
   SHA-256 fingerprint: run keytool -list -v -keystore ... (see guide)
   Host the association files:
   Copy the example files from website-association-files/
   Replace placeholders with your values
   Host at:
   https://saute.app/.well-known/apple-app-site-association
   https://saute.app/.well-known/assetlinks.json
   Ensure both are served with Content-Type: application/json
   Rebuild your app:
   npx expo prebuild --clean npx expo run:ios npx expo run:android
   Test:
   Send yourself: https://saute.app/invite/test123
   Open in Safari (iOS) or any browser (Android)
   The app should open automatically
   Important notes
   The iOS file must not have a .json extension
   Both files must be served with Content-Type: application/json
   Files must be accessible via HTTPS
   Universal Links on iOS only work when opened in Safari (not Chrome or in-app browsers)
   See UNIVERSAL_LINKS_SETUP.md for detailed instructions, troubleshooting, and validation tools.

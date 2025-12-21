# Bundle ID Guide: How to Choose and Set Your Bundle ID

## What is a Bundle ID?

A **Bundle ID** (iOS) or **Package Name** (Android) is a unique identifier for your app, similar to a domain name. It's written in reverse domain notation:
- Format: `com.yourcompany.appname`
- Example: `com.apple.mail`, `com.google.chrome`

## You Need to CREATE One (Not Find One)

Since your app doesn't have a bundle ID set yet, you need to **choose one**. Here's how:

### Step 1: Choose Your Bundle ID

Based on your app:
- **App Name**: Saute / Recipo
- **Suggested Bundle ID**: `com.saute.app` or `com.recipo.app`

**Common patterns:**
- `com.yourname.appname` (if personal project)
- `com.yourcompany.appname` (if company project)
- `io.yourname.appname` (alternative domain style)

**Important Rules:**
- Must be unique (no one else can use it)
- Use lowercase letters, numbers, dots, and hyphens only
- Typically starts with `com.`, `io.`, or `net.`
- Should match your domain if you have one

### Step 2: Add It to app.json

I'll update your `app.json` file with a suggested bundle ID. You can change it if you prefer something else.

### Step 3: Use the SAME Bundle ID in Google Cloud Console

When creating OAuth clients in Google Cloud Console:
- **iOS OAuth Client**: Use the exact same bundle ID from `app.json`
- **Android OAuth Client**: Use the exact same package name from `app.json`

They must match exactly, or authentication won't work!

## Current Status

Your `app.json` currently doesn't have bundle IDs set, so Expo is using a placeholder: `com.placeholder.appid`

## Next Steps

1. I'll add a bundle ID to your `app.json` (you can change it)
2. Use that **exact same bundle ID** when creating OAuth clients in Google Cloud Console
3. The bundle ID becomes permanent once you publish to app stores, so choose carefully!


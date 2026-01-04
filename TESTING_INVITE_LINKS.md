# Testing Invite Links Guide

## How to Test Invite Links

### ✅ Correct Way to Test

**Use the web URL in a browser:**
```
https://bitebookhq.app/invite/test123
```

This will:
1. Load the web page (`invite.html`)
2. The web page will try to open the app via `bitebook://invite/test123`
3. If the app is installed, it should open
4. The app should navigate to the invite screen

### ❌ Don't Use This in Browser

**Deep link scheme (won't work in browser):**
```
bitebook://invite/test123
```

This only works when:
- The app is already installed
- You're testing from a native context (not a browser)
- You use a command-line tool (see below)

---

## Testing Methods

### Method 1: Web URL (Recommended)

1. **Open in browser:**
   ```
   https://bitebookhq.app/invite/test123
   ```

2. **What should happen:**
   - Web page loads
   - Page tries to open app
   - App opens (if installed)
   - App navigates to invite screen

### Method 2: Deep Link (Command Line)

**iOS Simulator:**
```bash
xcrun simctl openurl booted "bitebook://invite/test123"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "bitebook://invite/test123" com.cgfeletar.bitebook
```

**iOS Device (via Safari console):**
```javascript
window.location = "bitebook://invite/test123";
```

---

## Debugging Steps

### 1. Check Console Logs

When you click the invite link, you should see these logs:

**In RootLayout:**
- `[RootLayout] Initial URL: ...`
- `[RootLayout] Found invite ID from initial URL: ...`
- `[RootLayout] Auth ready, navigating to invite`

**In InviteScreen:**
- `[InviteScreen] Mounted, params: ...`
- `[InviteScreen] Found invite ID in params: ...`

### 2. Check if URL is Being Received

Add this to see what URL the app receives:

```javascript
// In app/_layout.tsx, add:
console.log("All Linking events:", await Linking.getInitialURL());
```

### 3. Test if Universal Links Are Working

**iOS:**
- Universal links only work in Safari (not Chrome)
- Make sure the app is installed
- Delete and reinstall the app (iOS caches AASA files)

**Android:**
- App links work in any browser
- Make sure the app is installed
- Check that `assetlinks.json` is properly configured

---

## Common Issues

### App Opens but Stays on Splash Screen

**Possible causes:**
1. Auth not initializing - check console for auth logs
2. Navigation happening too early - we added delays to fix this
3. Router not ready - we wait for fonts to load first

**Solution:**
- Check console logs to see where it's getting stuck
- Make sure you see the navigation logs

### No Logs Appearing

**Possible causes:**
1. URL not reaching the app
2. Universal links not configured correctly
3. App not receiving the deep link

**Solution:**
- Test with command-line deep link first
- Check that `app.json` has correct configuration
- Verify universal links files are deployed

### Web Page Shows "Site Can't Be Reached"

**Possible causes:**
1. Firebase Hosting not deployed
2. Domain not configured
3. DNS not propagated

**Solution:**
```bash
# Deploy hosting
firebase deploy --only hosting

# Check if site is accessible
curl https://bitebookhq.app
```

---

## Quick Test Checklist

- [ ] Firebase Hosting deployed: `firebase deploy --only hosting`
- [ ] Domain `bitebookhq.app` configured in Firebase Console
- [ ] Web page accessible: `https://bitebookhq.app/invite/test123`
- [ ] App installed on test device
- [ ] Console logs showing URL events
- [ ] Navigation happening after app opens

---

## Next Steps

1. **Deploy hosting** (if not done):
   ```bash
   firebase deploy --only hosting
   ```

2. **Test the web URL:**
   - Open `https://bitebookhq.app/invite/test123` in browser
   - Check if app opens
   - Check console logs

3. **If still not working:**
   - Share the console logs you see
   - Check if the web page loads
   - Verify the app is receiving the URL


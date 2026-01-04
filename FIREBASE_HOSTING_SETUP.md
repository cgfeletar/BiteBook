# Firebase Hosting Custom Domain Setup Guide

This guide will help you configure `saute.app` as your Firebase Hosting domain so invite links work properly.

## Prerequisites

- You own the domain `saute.app`
- Access to your domain registrar's DNS settings
- Firebase project set up
- Firebase CLI installed (`npm install -g firebase-tools`)

---

## Step 1: Check Your Current Firebase Hosting Setup

First, let's see what hosting sites you have:

```bash
firebase hosting:sites:list
```

This will show you all your hosting sites. You should see something like:
- `your-project-id` (default site)
- Or a custom site if you've created one

---

## Step 2: Add Custom Domain in Firebase Console

### Option A: Using Firebase Console (Recommended)

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com](https://console.firebase.google.com)
   - Select your project

2. **Navigate to Hosting**
   - Click on **Hosting** in the left sidebar
   - If you haven't deployed yet, you'll see "Get started"

3. **Add Custom Domain**
   - Click **Add custom domain** button
   - Enter `saute.app` (without `www` or `https://`)
   - Click **Continue**

4. **Verify Domain Ownership**
   - Firebase will show you a **TXT record** to add to your DNS
   - It will look something like: `firebase=abc123def456`
   - Copy this record

5. **Add TXT Record to Your Domain**
   - Go to your domain registrar (where you bought `saute.app`)
   - Navigate to DNS settings
   - Add a new **TXT record**:
     - **Name/Host**: `@` or `saute.app` (depends on your registrar)
     - **Value**: The TXT record Firebase provided (e.g., `firebase=abc123def456`)
     - **TTL**: 3600 (or default)
   - Save the record

6. **Verify in Firebase**
   - Go back to Firebase Console
   - Click **Verify** button
   - Wait a few minutes for DNS propagation (can take up to 24 hours, but usually 5-15 minutes)

7. **Add DNS A Records**
   - After verification, Firebase will provide **A records** with IP addresses
   - Add these A records to your DNS:
     - **Type**: A
     - **Name**: `@` or `saute.app`
     - **Value**: The IP addresses Firebase provided (usually 2-4 IPs)
     - **TTL**: 3600
   - Save all records

8. **Wait for DNS Propagation**
   - DNS changes can take 5 minutes to 24 hours
   - You can check status in Firebase Console
   - Once complete, the domain will show as "Connected"

### Option B: Using Firebase CLI

```bash
# Login to Firebase
firebase login

# Add the custom domain
firebase hosting:channel:deploy production --only hosting

# Or add domain directly (if supported in your Firebase plan)
firebase hosting:domains:add saute.app
```

---

## Step 3: Deploy Your Hosting

Once the domain is connected, deploy your hosting:

```bash
# Deploy hosting
firebase deploy --only hosting
```

This will deploy:
- Your `public/` folder contents
- The `invite.html` page
- All your hosting configuration

---

## Step 4: Verify It's Working

1. **Check the default site**
   ```bash
   # Visit your default Firebase hosting URL
   # Usually: https://your-project-id.web.app
   ```

2. **Check your custom domain**
   ```bash
   # Visit: https://saute.app
   # Should show your index.html or invite page
   ```

3. **Test invite link**
   ```bash
   # Visit: https://saute.app/invite/test123
   # Should show the invite.html page
   ```

---

## Step 5: Update app.json for Universal Links

Once `saute.app` is working, update your `app.json` to use it:

```json
{
  "ios": {
    "associatedDomains": ["applinks:saute.app"]
  },
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          {
            "scheme": "https",
            "host": "saute.app",
            "pathPrefix": "/invite"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

---

## Step 6: Add Universal Links Files

Create the association files for iOS and Android:

### Create `.well-known` folder in `public/`

```bash
mkdir -p public/.well-known
```

### Create `public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.com.cgfeletar.bitebook",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

**Replace `YOUR_TEAM_ID`** with your Apple Team ID (found in Apple Developer Portal).

### Create `public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cgfeletar.bitebook",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

**Replace `YOUR_SHA256_FINGERPRINT`** with your app's SHA-256 fingerprint.

### Update firebase.json

The headers are already configured in your `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      }
    ]
  }
}
```

Add the assetlinks.json header:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      },
      {
        "source": "/.well-known/assetlinks.json",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      }
    ]
  }
}
```

---

## Step 7: Deploy Everything

```bash
# Deploy hosting with all files
firebase deploy --only hosting
```

---

## Troubleshooting

### Domain Not Verifying

1. **Check DNS Records**
   ```bash
   # Check if TXT record is set
   dig TXT saute.app
   
   # Check if A records are set
   dig A saute.app
   ```

2. **Wait Longer**
   - DNS can take up to 24 hours
   - Usually works within 15-30 minutes

3. **Check Firebase Console**
   - Look for error messages
   - Check the "Status" column

### Site Not Loading

1. **Check Deployment**
   ```bash
   firebase hosting:channel:list
   ```

2. **Check Default Site**
   - Visit `https://your-project-id.web.app`
   - If this works, the issue is with the custom domain

3. **Check DNS Propagation**
   ```bash
   # Check if domain points to Firebase
   dig saute.app
   # Should return Firebase IP addresses
   ```

### Invite Links Not Working

1. **Check the invite page**
   ```bash
   curl https://saute.app/invite/test123
   # Should return HTML content
   ```

2. **Check rewrite rules**
   - Verify `firebase.json` has the rewrite rule for `/invite/:inviteId`

3. **Check app deep links**
   - Make sure `app.json` has the correct scheme (`bitebook://`)

---

## Quick Checklist

- [ ] Domain `saute.app` added in Firebase Console
- [ ] TXT record added to DNS
- [ ] Domain verified in Firebase
- [ ] A records added to DNS
- [ ] Domain shows as "Connected" in Firebase
- [ ] `invite.html` created in `public/`
- [ ] `firebase.json` has rewrite rules
- [ ] `.well-known` files created
- [ ] `firebase.json` has headers for `.well-known` files
- [ ] Hosting deployed: `firebase deploy --only hosting`
- [ ] `https://saute.app` loads
- [ ] `https://saute.app/invite/test123` loads
- [ ] `app.json` updated with `saute.app` domain

---

## Next Steps

Once everything is set up:

1. Test invite links on real devices
2. Verify Universal Links work (iOS Safari)
3. Verify App Links work (Android)
4. Update your app store links in `invite.html`

---

## Need Help?

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Custom Domain Setup](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Support](https://firebase.google.com/support)


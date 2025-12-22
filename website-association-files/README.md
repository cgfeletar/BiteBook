# Website Association Files

These are example files you need to host on your website at `https://saute.app`.

## Files to Host

1. **`/.well-known/apple-app-site-association`** (iOS Universal Links)
   - Copy `apple-app-site-association.example`
   - Replace `YOUR_TEAM_ID` with your Apple Team ID
   - Remove `.example` extension
   - Host at: `https://saute.app/.well-known/apple-app-site-association`

2. **`/.well-known/assetlinks.json`** (Android App Links)
   - Copy `assetlinks.json.example`
   - Replace `YOUR_SHA256_FINGERPRINT` with your app's SHA-256 fingerprint
   - Remove `.example` extension
   - Host at: `https://saute.app/.well-known/assetlinks.json`

## Important Notes

- Both files must be served with `Content-Type: application/json`
- Files must be accessible via HTTPS
- Files must be served from the root domain (`saute.app`, not `www.saute.app`)
- No file extensions (the iOS file should NOT be `.json`)

## How to Get Your Values

### Apple Team ID
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Look in the top right corner for your Team ID (format: `ABC123DEF4`)

### SHA-256 Fingerprint (Android)
```bash
# For release keystore
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias

# For debug keystore (development)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Look for the **SHA-256** value and copy it (remove colons if present, or keep them - both formats work).

## Testing

After hosting the files, verify they're accessible:

```bash
curl -I https://saute.app/.well-known/apple-app-site-association
curl -I https://saute.app/.well-known/assetlinks.json
```

Both should return `Content-Type: application/json`.


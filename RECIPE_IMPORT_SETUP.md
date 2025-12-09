# Recipe Import Setup Guide

This guide will walk you through setting up the recipe import functionality using Google Gemini AI.

## Prerequisites

You should already have:
- ✅ Google Cloud project "savorboard-5d4cc"
- ✅ An API key (auto-created by Firebase)
- ✅ Generative Language API enabled
- ✅ Vertex AI API enabled
- ✅ Firebase project configured

## Step 1: Verify Your API Key

1. Go to [Google AI Studio API Keys](https://aistudio.google.com/api-keys)
2. You should see your API key listed. If you don't have one:
   - Click "Create API Key"
   - Select your project "savorboard-5d4cc"
   - Copy the API key (you'll need it in Step 3)

## Step 2: Verify Available Gemini Models

1. Go to [Google Cloud Console - APIs & Services](https://console.cloud.google.com/apis/dashboard?project=savorboard-5d4cc)
2. Make sure these APIs are enabled:
   - **Generative Language API** (generativelanguage.googleapis.com)
   - **Vertex AI API** (aiplatform.googleapis.com)

3. To check which models you have access to:
   - Go to [Google AI Studio](https://aistudio.google.com/app/models)
   - You should see available models like:
     - `gemini-1.5-pro` (recommended for best quality)
     - `gemini-1.5-flash` (faster, good quality)
     - `gemini-1.0-pro` (older version)

   **Note:** The code will automatically try `gemini-1.5-pro` first, then fall back to `gemini-1.5-flash` if the first fails.

## Step 3: Set Up API Key in Firebase Functions

You need to set the `GEMINI_API_KEY` environment variable in your Firebase Functions.

### Option A: Using Firebase CLI (Recommended)

1. Open your terminal in the project root
2. Run:
   ```bash
   firebase functions:config:set gemini.api_key="YOUR_API_KEY_HERE"
   ```
   Replace `YOUR_API_KEY_HERE` with your actual API key from Step 1.

3. Then update your `functions/src/index.ts` to read from config (if not already):
   ```typescript
   const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
   ```

### Option B: Using Environment Variables (Modern Approach)

Since `functions.config()` is deprecated, use environment variables instead:

1. Create a `.env` file in the `functions/` directory:
   ```bash
   cd functions
   touch .env
   ```

2. Add your API key to `.env`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Install `dotenv` package:
   ```bash
   cd functions
   npm install dotenv
   ```

4. Update `functions/src/index.ts` to load environment variables:
   ```typescript
   import * as dotenv from 'dotenv';
   dotenv.config();
   ```

5. **Important:** Add `.env` to `.gitignore` to keep your API key secure:
   ```bash
   echo ".env" >> functions/.gitignore
   ```

6. When deploying, set the environment variable:
   ```bash
   firebase functions:config:set gemini.api_key="YOUR_API_KEY"
   ```
   Or use Firebase's environment configuration:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
   (This will prompt you to enter the secret)

### Option C: Using Firebase Secrets (Most Secure - Recommended for Production)

1. Set the secret:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
   Enter your API key when prompted.

2. Update `functions/src/index.ts` to use the secret:
   ```typescript
   // At the top of the file
   import { defineSecret } from 'firebase-functions/params';
   
   const geminiApiKey = defineSecret('GEMINI_API_KEY');
   
   // In your function
   export const extractRecipeFromUrl = functions
     .runWith({ secrets: [geminiApiKey] })
     .https.onCall(async (data, context) => {
       // ... existing code ...
       const apiKey = geminiApiKey.value();
       // ... rest of function ...
     });
   ```

## Step 4: Verify Quotas and Billing

1. Go to [Google Cloud Console - Quotas](https://console.cloud.google.com/iam-admin/quotas?project=savorboard-5d4cc)
2. Search for "Generative Language API" or "Gemini"
3. Check that you have:
   - Requests per minute quota
   - Tokens per minute quota
   - Daily quota limits

4. Make sure billing is enabled:
   - Go to [Billing](https://console.cloud.google.com/billing?project=savorboard-5d4cc)
   - Ensure a billing account is linked

## Step 5: Deploy Firebase Functions

**Note:** Your functions are configured to use the `europe-central2` region.

1. Build the functions:
   ```bash
   cd functions
   npm run build
   ```

2. Deploy the function:
   ```bash
   firebase deploy --only functions:extractRecipeFromUrl
   ```

   Or deploy all functions:
   ```bash
   firebase deploy --only functions
   ```

3. Verify deployment:
   ```bash
   firebase functions:list
   ```

   You should see your functions listed with region `europe-central2`.

## Step 6: Test the Function

You can test the function using the Firebase Console:

1. Go to [Firebase Console - Functions](https://console.firebase.google.com/u/1/project/savorboard-5d4cc/functions)
2. Click on `extractRecipeFromUrl`
3. Use the "Test" tab to test with a sample URL

Or test from your app:
1. Open the app
2. Tap the "+" button in the top right
3. Paste a recipe URL (e.g., from AllRecipes, Food Network, etc.)
4. Tap "Import Recipe"

## Troubleshooting

### Error: "GEMINI_API_KEY environment variable is not set"
- Make sure you've set the API key using one of the methods in Step 3
- If using `.env`, make sure `dotenv` is installed and configured
- Restart the Firebase emulator or redeploy functions

### Error: "All Gemini models failed"
- Check that Generative Language API is enabled
- Verify your API key is correct
- Check quotas haven't been exceeded
- Try a different model name in the code

### Error: "Failed to fetch URL"
- The URL might be blocking requests
- Check that the URL is publicly accessible
- Some sites require specific headers or authentication

### Function timeout
- Increase the timeout in `functions/src/index.ts`:
  ```typescript
  export const extractRecipeFromUrl = functions
    .runWith({ timeoutSeconds: 60 })
    .https.onCall(...)
  ```

## API Usage and Costs

- **Gemini 1.5 Pro**: ~$0.00125 per 1K input tokens, ~$0.005 per 1K output tokens
- **Gemini 1.5 Flash**: ~$0.000075 per 1K input tokens, ~$0.0003 per 1K output tokens
- Typical recipe extraction: ~10K-50K input tokens, ~2K-5K output tokens
- Estimated cost per recipe: $0.01-$0.10 (depending on model and recipe complexity)

Monitor usage at: [Google Cloud Console - Billing](https://console.cloud.google.com/billing?project=savorboard-5d4cc)

## Next Steps

Once setup is complete:
1. ✅ Recipe import button is on the homepage (green "+" button)
2. ✅ Users can paste URLs to import recipes
3. ✅ Recipes are automatically added to the homepage feed
4. ✅ Recipes persist until manually deleted

## Support

If you encounter issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check Google Cloud Console logs
3. Verify API key permissions and quotas


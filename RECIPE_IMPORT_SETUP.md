# Recipe Import Setup Guide

This guide will walk you through setting up the recipe import functionality using OpenAI GPT.

## Prerequisites

You should already have:

- ✅ Google Cloud project "savorboard-5d4cc"
- ✅ Firebase project configured
- ✅ OpenAI API account with API key

## Step 1: Get Your OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Give it a name (e.g., "Recipe Import")
5. Copy the API key (you'll need it in Step 2)
   - **Important:** Save this key securely - you won't be able to see it again!

## Step 2: Set Up API Key in Firebase Functions

You need to set the `OPENAI_API_KEY` secret in your Firebase Functions.

### Using Firebase Secrets (Recommended)

1. Set the secret:

   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```

   Enter your OpenAI API key when prompted.

2. The function is already configured to use this secret in `functions/src/index.ts`:
   ```typescript
   export const extractRecipeFromUrl = functions
     .runWith({ secrets: [OPENAI_API_KEY] })
     .https.onCall(async (data, context) => {
       // Uses OPENAI_API_KEY secret
     });
   ```

## Step 3: Verify Quotas and Billing

1. Go to [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Check your:
   - API usage and limits
   - Billing settings
   - Rate limits

3. Make sure billing is enabled:
   - Go to [OpenAI Billing](https://platform.openai.com/account/billing)
   - Ensure a payment method is added

## Step 4: Deploy Firebase Functions

**Note:** Your functions are configured to use the `us-central1` region.

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

   You should see your functions listed with region `us-central1`.

## Step 5: Test the Function

You can test the function using the Firebase Console:

1. Go to [Firebase Console - Functions](https://console.firebase.google.com/u/1/project/savorboard-5d4cc/functions)
2. Click on `extractRecipeFromUrl`
3. Use the "Test" tab to test with a sample URL

Or test from your app:

1. Open the app
2. Tap the "+" button in the bottom navigation
3. Paste a recipe URL (e.g., from AllRecipes, Food Network, TikTok, etc.)
4. Tap "Import Recipe"

## Troubleshooting

### Error: "OPENAI_API_KEY secret is not set"

- Make sure you've set the secret using `firebase functions:secrets:set OPENAI_API_KEY`
- Verify the secret name matches exactly: `OPENAI_API_KEY`
- Redeploy functions after setting the secret

### Error: "OpenAI API request failed"

- Check that your API key is valid
- Verify you have credits/billing enabled on your OpenAI account
- Check rate limits haven't been exceeded
- Review OpenAI API status: https://status.openai.com/

### Error: "Failed to fetch URL"

- The URL might be blocking requests
- Check that the URL is publicly accessible
- Some sites require specific headers or authentication

### Function timeout

- The function has a default timeout
- Complex recipes may take longer to process
- Check Firebase Functions logs for timeout errors

## API Usage and Costs

- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Typical recipe extraction: ~10K-30K input tokens, ~2K-5K output tokens
- Estimated cost per recipe: $0.002-$0.02 (very cost-effective)

Monitor usage at: [OpenAI Usage Dashboard](https://platform.openai.com/usage)

## Model Information

The function uses **GPT-4o-mini** which provides:
- Fast response times
- High-quality recipe extraction
- Cost-effective pricing
- Good understanding of cooking instructions and ingredients

## Next Steps

Once setup is complete:

1. ✅ Recipe import button is in the bottom navigation (green "+" button)
2. ✅ Users can paste URLs to import recipes from any website, TikTok, Instagram, etc.
3. ✅ Recipes are automatically added to the homepage feed
4. ✅ Recipes persist until manually deleted
5. ✅ Timer functionality available for steps with time durations

## Support

If you encounter issues:

1. Check Firebase Functions logs: `firebase functions:log`
2. Check Google Cloud Console logs
3. Verify OpenAI API key permissions and billing
4. Review OpenAI API documentation: https://platform.openai.com/docs

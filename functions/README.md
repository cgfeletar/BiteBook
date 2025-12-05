# Firebase Cloud Functions

This directory contains Firebase Cloud Functions for the Recipo app.

## Setup

1. Install dependencies:
```bash
cd functions
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Set up environment variables:
- Add your LLM API key to Firebase Functions config:
```bash
firebase functions:config:set openai.api_key="your-api-key"
# OR
firebase functions:config:set gemini.api_key="your-api-key"
```

## Functions

### `extractRecipeFromUrl`

Extracts structured recipe data from a URL using web scraping and LLM.

**Parameters:**
- `url` (string): The URL of the recipe to extract

**Returns:**
- Recipe object matching the Recipe TypeScript interface (without `id` and `createdAt`)

**Usage:**
```typescript
const extractRecipe = httpsCallable(functions, 'extractRecipeFromUrl');
const result = await extractRecipe({ url: 'https://example.com/recipe' });
```

## LLM Integration

The function uses an LLM (OpenAI GPT-4/3.5 or Google Gemini) to extract structured recipe data from messy HTML. 

**To implement the LLM call:**
1. Uncomment and configure either the OpenAI or Gemini example in `src/index.ts`
2. Add your API key to Firebase Functions config
3. Update the `callLLM` function with your preferred provider

## Deployment

```bash
firebase deploy --only functions
```


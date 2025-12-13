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

3. Set up API key:
- Add your OpenAI API key as a Firebase secret:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```
Enter your OpenAI API key when prompted.

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

The function uses OpenAI GPT-4o-mini to extract structured recipe data from messy HTML. 

**Configuration:**
- The function is already configured to use OpenAI
- Uses the `OPENAI_API_KEY` secret set in Firebase Functions
- Model: GPT-4o-mini (fast and cost-effective)

## Deployment

```bash
firebase deploy --only functions
```


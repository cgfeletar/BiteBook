import { create } from 'zustand';
import { Recipe } from '../types';

export interface RecipeBook {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  recipeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface RecipeBooksState {
  books: RecipeBook[];
  recipes: Recipe[]; // Store recipes in books
  addBook: (book: Omit<RecipeBook, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBook: (id: string, updates: Partial<RecipeBook>) => void;
  deleteBook: (id: string) => void;
  addRecipeToBook: (bookId: string, recipeId: string, recipeCoverImage?: string) => void;
  removeRecipeFromBook: (bookId: string, recipeId: string) => void;
  addRecipe: (recipe: Recipe) => void;
  getRecipesInBook: (bookId: string) => Recipe[];
}

// Example recipe books
const exampleBooks: RecipeBook[] = [
  {
    id: 'book-1',
    name: 'Desserts',
    description: 'Sweet treats and baked goods',
    recipeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'book-2',
    name: 'Gluten Free',
    description: 'Recipes without gluten',
    recipeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'book-3',
    name: 'Healthy Dinner',
    description: 'Nutritious dinner recipes',
    recipeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'book-4',
    name: 'Quick Meals',
    description: 'Fast and easy recipes',
    recipeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const useRecipeBooksStore = create<RecipeBooksState>((set, get) => ({
  books: exampleBooks,
  recipes: [],

  addBook: (bookData) => {
    const newBook: RecipeBook = {
      ...bookData,
      id: `book-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      books: [...state.books, newBook],
    }));
  },

  updateBook: (id, updates) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === id
          ? { ...book, ...updates, updatedAt: new Date() }
          : book
      ),
    }));
  },

  deleteBook: (id) => {
    set((state) => ({
      books: state.books.filter((book) => book.id !== id),
    }));
  },

  addRecipeToBook: (bookId, recipeId, recipeCoverImage) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId && !book.recipeIds.includes(recipeId)
          ? {
              ...book,
              recipeIds: [...book.recipeIds, recipeId],
              coverImage: recipeCoverImage || book.coverImage, // Update cover image to most recent recipe
              updatedAt: new Date(),
            }
          : book
      ),
    }));
  },

  removeRecipeFromBook: (bookId, recipeId) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              recipeIds: book.recipeIds.filter((id) => id !== recipeId),
              updatedAt: new Date(),
            }
          : book
      ),
    }));
  },

  addRecipe: (recipe) => {
    set((state) => {
      const existing = state.recipes.find((r) => r.id === recipe.id);
      if (existing) {
        return state;
      }
      return {
        recipes: [...state.recipes, recipe],
      };
    });
  },

  getRecipesInBook: (bookId) => {
    const state = get();
    const book = state.books.find((b) => b.id === bookId);
    if (!book) return [];
    return state.recipes.filter((recipe) => book.recipeIds.includes(recipe.id));
  },
}));


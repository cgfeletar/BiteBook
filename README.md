# BiteBook

A full-stack collaborative recipe management and meal planning mobile app built with React Native, Expo, and Firebase. Users can save, organize, and share recipes, plan meals, manage shopping lists, and track pantry inventory — all in real-time across devices.

<!-- Add screenshots here: ![Home Screen](assets/screenshots/home.png) -->

## Tech Stack

| Layer                | Technology                                                  |
| -------------------- | ----------------------------------------------------------- |
| **Language**         | TypeScript (strict mode)                                    |
| **Framework**        | React Native 0.81 + Expo SDK 54                             |
| **React**            | React 19 with React Compiler enabled                        |
| **Navigation**       | Expo Router (file-based routing) + React Navigation 7       |
| **State Management** | Zustand with AsyncStorage persistence                       |
| **Styling**          | NativeWind (Tailwind CSS for React Native)                  |
| **Backend**          | Firebase Cloud Functions (Node 20, TypeScript)              |
| **Database**         | Cloud Firestore (real-time subscriptions)                   |
| **Authentication**   | Firebase Auth (Email/Password, Google OAuth, Apple Sign-In) |
| **Storage**          | Firebase Storage (recipe images)                            |
| **Image Processing** | Google Cloud Vision API, Sharp                              |
| **Search**           | Fuse.js (client-side fuzzy search)                          |

## Features

- **Recipe Management** — Create, edit, and organize recipes with ingredients, instructions, nutrition info, ratings, and tags
- **Smart Import** — Import recipes from URLs (web scraping via Cloud Functions) or photos (OCR via Google Cloud Vision)
- **Meal Planning** — Plan meals across days with a dedicated calendar view
- **Shopping Lists** — Auto-generated and manually managed shopping lists with aisle-based organization
- **Pantry Tracking** — Track pantry inventory to know what you have on hand
- **Kitchen Collaboration** — Share recipe collections with others via invite links and deep linking (`bitebook://`)
- **Offline-First** — Local persistence with AsyncStorage; syncs to Firestore when online
- **Cross-Platform** — Runs on iOS, Android, and web

## Architecture

```
app/                     # Expo Router file-based routes
  (tabs)/                # Bottom tab navigation (Home, Add, Progress, Meal Plan, Shopping)
  (auth)/                # Auth screens (login, signup)
  recipe-detail.tsx      # Recipe detail modal
  invite/[inviteId].tsx  # Dynamic deep link handling
src/
  config/                # Firebase configuration
  services/              # Auth provider, Firestore service layer
  store/                 # Zustand stores (auth, recipes, shopping, pantry, meal plan, progress)
  hooks/                 # Custom React hooks
  types/                 # TypeScript interfaces
  utils/                 # Helper functions
components/              # Reusable UI components
  recipe-detail/         # Recipe detail sub-components
  ui/                    # UI primitives
functions/               # Firebase Cloud Functions (recipe scraping, image processing)
```

**Key architectural decisions:**

- **Optimistic updates** — Local state updates instantly via Zustand; Firestore syncs in the background for a snappy UX
- **Real-time sync** — Firestore `onSnapshot` listeners keep data consistent across devices
- **Kitchen-based data model** — Recipes and shopping lists are scoped to "kitchens," enabling multi-user collaboration with shared state
- **File-based routing** — Expo Router provides type-safe, file-system-based navigation with deep linking support

## How to run (Personal notes)

### Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Firebase project with Firestore, Auth, Storage, and Cloud Functions enabled
- iOS Simulator / Android Emulator or physical device with Expo Go

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Run Cloud Functions locally
cd functions && npm install && npm run serve
```

### Firebase Setup

1. Create a Firebase project and enable Firestore, Authentication (Email, Google, Apple), and Storage
2. Add your Firebase config to `src/config/firebase.ts`
3. Deploy Firestore rules and Cloud Functions:

```bash
firebase deploy --only firestore:rules,storage,functions
```

## Notable Libraries

| Library                                        | Purpose                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `nativewind` + `tailwindcss`                   | Utility-first styling with a custom color palette (sage-green, warm-sand, mocha, etc.) |
| `zustand`                                      | Lightweight state management with middleware for persistence                           |
| `expo-router`                                  | File-based routing with typed routes                                                   |
| `react-native-reanimated`                      | Performant animations                                                                  |
| `react-native-gesture-handler`                 | Native touch gesture support                                                           |
| `fuse.js`                                      | Client-side fuzzy search for recipes                                                   |
| `@react-native-seoul/masonry-list`             | Pinterest-style masonry grid layout                                                    |
| `expo-image-picker` + `expo-image-manipulator` | Image capture and processing                                                           |
| `expo-haptics`                                 | Haptic feedback for tactile interactions                                               |
| `@expo-google-fonts/lora`                      | Custom typography                                                                      |
| `lucide-react-native`                          | Icon system                                                                            |

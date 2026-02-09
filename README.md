# Nani - Intelligent Grocery Platform

Nani is a premium, AI-powered grocery shopping platform designed to transform how users discover and purchase ingredients. It combines a modern e-commerce experience with **Nani Assist**, a highly advanced agentic culinary AI.

![Nani Assist](https://placehold.co/1200x400/1a4731/ffffff?text=Nani+Assist+AI)

## 🧠 Nani Assist: The AI Culinary Concierge

At the heart of Nani is **Nani Assist**, an agentic AI powered by Google's Gemini 2.5 Flash and Algolia Search. It goes far beyond a standard chatbot—it is a fully integrated store assistant with direct control over the shopping experience.

### Key Capabilities

#### 1. 🛒 Agentic "Active" Cart Management
Nani Assist has "Agency." It doesn't just talk; it acts.
- **Direct Buying**: User says *"Add onions and garlic"*, and the agent instantly adds the correct items to the cart.
- **Recipe-to-Cart**: User says *"I want to make Spaghetti Carbonara"*. The agent finds the recipe, identifies the ingredients (Guanciale, Pecorino, Spaghetti), and adds them all to the cart in one click.

#### 2. 👁️ Inventory Omniscience
The agent possesses real-time knowledge of Nani's entire catalog of **23,000+ items**.
- **Smart matching**: It knows prices, categories, and stock status.
- **No Hallucinations**: It filters recommendations against actual inventory, ensuring users can only buy what is truly available.

#### 3. 🍳 Culinary & Recipe Intelligence
- **Contextual Understanding**: If a user asks for *"Japanese food"*, the agent intelligently infers intent and suggests Sushi-grade fish, Ramen noodles, or Miso, without needing specific product names.
- **Algolia Integration**: Instantly retrieves cooking instructions, preparation times, and ingredient lists from a professional recipe database.

#### 4. 🧠 Context Awareness
- **Cart Status**: The agent can "see" the user's current cart. If the cart is empty, it guides discovery. If populated, it suggests complementary items.
- **Smart Search**: It automatically detects when a user's query requires a database lookup (e.g., "Find organic tomatoes") versus a general culinary question.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Model**: Google Gemini 2.5 Flash
- **Search & Data**: Algolia Search / ID-based Seeded Randomization for Mock Data
- **State Management**: React Context API

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

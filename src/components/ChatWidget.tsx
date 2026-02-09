'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, ArrowUp, Trash2, Copy, Check, Search, ShoppingBag } from 'lucide-react';
import { algoliasearch } from 'algoliasearch';
import { Message, Agent, Product } from '@/lib/types';
import { products, mockRecipes } from '@/lib/data';
import { useStore } from '@/context/StoreContext';

// Initialize Algolia client
const algoliaClient = algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
);

// Helper for Fuzzy Search (Levenshtein Distance)
const getLevenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

// Enhanced search function for ingredients - searches REAL Algolia index
const searchIngredients = async (query: string): Promise<{ text: string; products: Product[] }> => {
    try {
        // 1. Try searching Algolia 'ingredients' index first for real scale
        const { hits } = await algoliaClient.search([{
            indexName: 'ingredients', // Assuming this index was created from ingredients_final.json
            params: { query, hitsPerPage: 10 }
        }]).then(res => res.results[0] as any);

        if (hits && hits.length > 0) {
            // Map Algolia hits to our Product schema
            const mappedProducts: Product[] = hits.map((hit: any) => ({
                id: hit.objectID,
                name: hit.name || hit.title,
                price: hit.price || 4.99, // Fallback price if not indexed
                category: hit.category || 'Pantry',
                image: hit.image || `https://tse2.mm.bing.net/th?q=${encodeURIComponent(hit.name || query)}&w=800&h=800&c=7&rs=1&p=0`,
                rating: 4.5,
                reviews: 100,
                isNew: false,
                dietary: [],
                description: hit.description || `Premium ${hit.name} sourced for you.`,
                popularity: 80,
                dateAdded: new Date().toISOString()
            }));

            const text = mappedProducts.map(p =>
                `- ${p.name} (${p.category}) - $${p.price.toFixed(2)} [ID: ${p.id}]`
            ).join('\n');
            return { text, products: mappedProducts };
        }
    } catch (e) {
        console.warn('Algolia ingredient search failed, falling back to local:', e);
    }

    // 2. Fallback to local filtering if Algolia fails or returns nothing
    const queryLower = query.toLowerCase();

    // First pass: Exact includes match
    let localResults = products.filter(p =>
        p.name.toLowerCase().includes(queryLower) ||
        p.category.toLowerCase().includes(queryLower)
    ).slice(0, 10);

    // Second pass: Fuzzy match if no exact results
    if (localResults.length === 0 && query.length > 3) {
        localResults = products.filter(p => {
            const nameLower = p.name.toLowerCase();
            // Check if distance is small enough (allow 1 error per 4 chars approx)
            const tolerance = Math.floor(query.length / 4) + 1;

            // Check full name or individual words
            if (getLevenshteinDistance(queryLower, nameLower) <= tolerance) return true;

            // Check individual words in product name
            const words = nameLower.split(' ');
            return words.some(w => getLevenshteinDistance(queryLower, w) <= tolerance);
        }).slice(0, 5);
    }

    if (localResults.length > 0) {
        const text = localResults.map(p =>
            `- ${p.name} (${p.category}) - $${p.price.toFixed(2)} [ID: ${p.id}]`
        ).join('\n');
        return { text, products: localResults };
    }
    return { text: 'No ingredients found matching your query.', products: [] };
};

// Enhanced recipe search - returns full recipe details
const searchRecipes = async (query: string): Promise<{ text: string; recipes: any[] }> => {
    try {
        const { hits } = await algoliaClient.search([{
            indexName: 'food',
            params: { query, hitsPerPage: 5 }
        }]).then(res => res.results[0] as any);

        if (hits && hits.length > 0) {
            const text = hits.map((hit: any) =>
                `- "${hit.title}" - Ingredients: ${hit.ingredients?.slice(0, 5).join(', ')}${hit.ingredients?.length > 5 ? '...' : ''}`
            ).join('\n');
            return { text, recipes: hits };
        }
    } catch (error) {
        console.error('Recipe search error, using fallback:', error);
    }

    // Fallback to local mock recipes if Algolia fails or returns nothing
    const queryLower = query.toLowerCase();
    const localRecipes = mockRecipes.filter(r =>
        r.title.toLowerCase().includes(queryLower) ||
        r.ingredients.some(i => i.toLowerCase().includes(queryLower))
    ).slice(0, 3);

    if (localRecipes.length > 0) {
        const text = localRecipes.map((r: any) =>
            `- "${r.title}" - Ingredients: ${r.ingredients?.slice(0, 5).join(', ')}${r.ingredients?.length > 5 ? '...' : ''}`
        ).join('\n');
        return { text, recipes: localRecipes };
    }

    return { text: 'No recipes found matching your query.', recipes: [] };
};

// Find matching products for recipe ingredients
const findProductsForIngredients = (ingredients: string[]): Product[] => {
    const matchedProducts: Product[] = [];

    for (const ingredient of ingredients) {
        const cleanIngredient = ingredient
            .toLowerCase()
            .replace(/\d+(\.\d+)?\s*(oz|lb|g|kg|cup|tsp|tbsp|dash|pinch|slice|piece|clove)?s?\.?\s*/g, '')
            .replace(/\(.*\)/g, '')
            .trim();

        if (cleanIngredient.length < 3) continue;

        // Find a matching product
        const match = products.find(p => {
            const productName = p.name.toLowerCase();
            return productName.includes(cleanIngredient) || cleanIngredient.includes(productName);
        });

        if (match && !matchedProducts.find(m => m.id === match.id)) {
            matchedProducts.push(match);
        }
    }

    return matchedProducts;
};

// Enhanced system prompt with cart capabilities
const SYSTEM_PROMPT = `You are Nani Assist, a highly advanced agentic culinary AI for Nani, a premium grocery platform. You are not just a chatbot; you are an intelligent culinary concierge with direct access to the store's infrastructure.

YOUR IDENTITY & POWERS:
1.  **Inventory Omniscience**: You do not just "guess"; you have real-time access to DOKO's massive inventory of 23,000+ items (ingredients_final.json). You know prices, categories, and availability.
2.  **Recipe Intelligence**: You are integrated with a professional Algolia-powered recipe database. You can instantly retrieve detailed instructions, cooking times, and ingredient lists.
3.  **Active Cart Management**: You possess the "Agency" to modify the user's shopping cart. When a user says "buy this" or "add ingredients," you process this action instantly.
4.  **Cuisine Awareness**: You understand culinary taxonomy. If a user asks for "Japanese," you know to look for Sushi, Ramen, or Teriyaki, even if they don't specify the dish.

HOW TO USE YOUR INTELLIGENT DATA RETRIEVAL:
You will receive context in specific formats. You MUST interpret this data intelligently:

- **[RECIPES FOUND]**: These are real records from the database.
    *   *Action*: Analyze them. Recommend the best one based on the user's query. Mention the title, cook time, and key ingredients.
    *   *Example*: "I found a fantastic 'Spaghetti Carbonara' recipe that takes only 20 minutes."

- **[PRODUCTS FOUND]**: These are items available in the store right now.
    *   *Action*: Suggest them as specific purchases. Mention their *exact* names and prices if available.
    *   *Example*: "For that, I recommend the 'Organic Basil' ($3.99) and 'Roma Tomatoes'."

- **[ITEMS ADDED TO CART]**: You have successfully executed a cart transaction.
    *   *Action*: Confirm the action with authority and list the items.
    *   *IMPORTANT*: To actually add items to the user's cart that you found in the product list, you MUST output this tag followed by the list of items. The system will detect this and execute the add operation.
    *   *Example*: "[ITEMS ADDED TO CART]: - Organic Basil - Roma Tomatoes"

- **[NO RESULTS]**:
    *   *Action*: Use your general culinary knowledge to guide the user back to valid paths.
    *   *Example*: "I couldn't find a specific recipe for 'Moon Rock Soup', but our inventory has excellent ingredients for traditional stone soups or root vegetable stews. Should we explore those?"

OPERATIONAL RULES:
- **Be Agentic**: Don't just answer; propose the next step. "Shall I add these ingredients to your cart?"
- **Be Concise but Expert**: Speak with the confidence of a Michelin-star chef who is also a data scientist.
- **Never Hallucinate Inventory**: If it's not in [PRODUCTS FOUND], don't say we sell it. Instead, say "I can look for a substitute."
- **Formatting**: Use bolding for **Product Names** and *Recipe Titles* to make them stand out.`;

// Create initial messages as a function to avoid SSR/client timestamp mismatch
const createInitialMessages = (): Message[] => [
    {
        id: '1',
        text: "Welcome to Nani. I'm here to help you find fresh ingredients and delicious recipes. How may I assist you?",
        sender: 'agent',
        timestamp: new Date(),
    },
];

const AGENT: Agent = {
    name: 'Nani Assist',
    avatar: '',
    status: 'online',
};

// Keywords that trigger search
const INGREDIENT_KEYWORDS = ['ingredient', 'have', 'stock', 'find', 'looking for', 'need', 'buy', 'purchase', 'get', 'available', 'search', 'add'];
const RECIPE_KEYWORDS = ['recipe', 'cook', 'make', 'prepare', 'dish', 'meal', 'dinner', 'lunch', 'breakfast', 'pasta', 'chicken', 'beef', 'salad', 'japanese', 'chinese', 'italian', 'mexican', 'indian'];
const ADD_TO_CART_KEYWORDS = ['add to cart', 'add all', 'add ingredients', 'buy ingredients', 'get ingredients', 'add items', 'add everything', 'buy', 'purchase'];

// Cuisine to Popular Dishes Map for Smart Search Expansion
const CUISINE_MAP: Record<string, string> = {
    'japanese': 'sushi ramen tempura teriyaki udon miso',
    'chinese': 'stir fry dim sum fried rice noodles dumplings',
    'italian': 'pasta pizza risotto lasagna carbonara',
    'mexican': 'tacos burrito enchilada guacamole salsa fajitas',
    'indian': 'curry tikka masala biryani naan',
    'american': 'burger steak sandwich bbq wings',
    'thai': 'pad thai curry soup satay',
    'french': 'croissant baguette ratatouille steak frites',
    'mediterranean': 'hummus falafel kebab salad greek'
};

const ChatWidget: React.FC = () => {
    const { addToCart, cart } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [itemsAddedToCart, setItemsAddedToCart] = useState<Product[]>([]);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Store chat history for context
    const chatHistoryRef = useRef<Array<{ role: string; parts: Array<{ text: string }> }>>([
        { role: 'model', parts: [{ text: 'Welcome to Doko...' }] }
    ]);

    // Initialize messages on client only to avoid hydration mismatch
    useEffect(() => {
        const initialMsgs = createInitialMessages();
        setMessages(initialMsgs);
        chatHistoryRef.current = [
            { role: 'model', parts: [{ text: initialMsgs[0].text }] }
        ];
        setIsMounted(true);
    }, []);

    // Format time consistently
    const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleClearChat = () => {
        const initialMsgs = createInitialMessages();
        setMessages(initialMsgs);
        chatHistoryRef.current = [
            { role: 'model', parts: [{ text: initialMsgs[0].text }] }
        ];
    };

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            const { scrollHeight, clientHeight } = chatContainerRef.current;
            const maxScrollTop = scrollHeight - clientHeight;
            chatContainerRef.current.scrollTo({
                top: maxScrollTop > 0 ? maxScrollTop : 0,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => scrollToBottom(), 100);
        return () => clearTimeout(timeoutId);
    }, [messages, isOpen, isTyping]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handlePromptClick = (prompt: string) => {
        setInputValue(prompt);
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    };

    const handleCopy = async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    // Detect if query needs retrieval and what type
    const analyzeQuery = (query: string): { needsIngredientSearch: boolean; needsRecipeSearch: boolean; searchTerms: string } => {
        const lowerQuery = query.toLowerCase();
        const needsIngredientSearch = INGREDIENT_KEYWORDS.some(k => lowerQuery.includes(k));
        const needsRecipeSearch = RECIPE_KEYWORDS.some(k => lowerQuery.includes(k));

        // Extract food-related terms, prioritizing actual food words
        const foodKeywords = ['pasta', 'spaghetti', 'carbonara', 'chicken', 'beef', 'salad', 'soup', 'pizza', 'burger', 'steak', 'fish', 'salmon', 'shrimp', 'rice', 'noodle', 'curry', 'taco', 'sandwich', 'cake', 'cookie', 'bread', 'tomato', 'vegetable', 'fruit', 'sushi', 'ramen', 'tempura', 'teriyaki'];
        const actionWords = ['add', 'all', 'ingredients', 'make', 'cart', 'buy', 'get', 'find', 'search', 'want', 'need', 'looking', 'for', 'the', 'and', 'with', 'some', 'dish', 'food', 'cuisine', 'recipe'];

        let searchTerms = '';

        // 1. Check for specific Cuisines and Expand Search
        for (const [cuisine, dishes] of Object.entries(CUISINE_MAP)) {
            if (lowerQuery.includes(cuisine)) {
                // If user asks for "Japanese", we search for "Japanese sushi ramen..." to maximize hits
                searchTerms = `${cuisine} ${dishes}`;
                return { needsIngredientSearch, needsRecipeSearch: true, searchTerms };
            }
        }

        // 2. Check for specific Food Keywords
        const foundFoods = foodKeywords.filter(f => lowerQuery.includes(f));
        if (foundFoods.length > 0) {
            return { needsIngredientSearch, needsRecipeSearch, searchTerms: foundFoods.join(' ') };
        }

        // 3. Fallback: Extract words, filtering out action words
        const words = query.split(/\s+/)
            .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
            .filter(w => w.length > 3 && !actionWords.includes(w));
        searchTerms = words.slice(0, 3).join(' ');

        return { needsIngredientSearch, needsRecipeSearch, searchTerms };
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();

        const newUserMessage: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, newUserMessage]);
        setInputValue('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        setIsTyping(true);
        const agentMsgId = (Date.now() + 1).toString();

        setMessages(prev => [...prev, {
            id: agentMsgId,
            text: '',
            sender: 'agent',
            timestamp: new Date(),
            isStreaming: true
        } as Message & { isStreaming?: boolean }]);

        try {
            // Analyze query for retrieval needs
            const { needsIngredientSearch, needsRecipeSearch, searchTerms } = analyzeQuery(userText);
            const lowerText = userText.toLowerCase();
            const wantsToAddToCart = ADD_TO_CART_KEYWORDS.some(k => lowerText.includes(k));

            let contextualPrompt = userText;
            let addedProducts: Product[] = [];
            let foundIngredients: Product[] = []; // Store ingredients found during search

            // INJECT CURRENT CART STATUS if user mentions "cart"
            if (lowerText.includes('cart') || lowerText.includes('bag')) {
                const cartSummary = cart.length > 0
                    ? `[CURRENT USER CART STATUS]: The user currently has ${cart.length} items in their cart: ${cart.map(i => `${i.name} (Qty: ${i.quantity || 1})`).join(', ')}.`
                    : `[CURRENT USER CART STATUS]: The user's cart is currently EMPTY.`;

                contextualPrompt = cartSummary + "\n\n" + contextualPrompt;
            }

            // Perform Algolia retrieval if needed
            if (needsIngredientSearch || needsRecipeSearch || wantsToAddToCart) {
                setIsSearching(true);
                let searchContext = '\n\n[SEARCH RESULTS FROM ALGOLIA]:\n';

                if (needsIngredientSearch) {
                    const { text: ingredientResults, products: p } = await searchIngredients(searchTerms || userText);
                    foundIngredients = p;
                    searchContext += `\n[PRODUCTS FOUND]:\n${ingredientResults}\n`;
                }

                if (needsRecipeSearch || wantsToAddToCart) {
                    const { text: recipeResults, recipes } = await searchRecipes(searchTerms || userText);
                    searchContext += `\n[RECIPES FOUND]:\n${recipeResults}\n`;

                    // If user wants to add ingredients to cart, find and add them
                    if (wantsToAddToCart && recipes.length > 0) {
                        const firstRecipe = recipes[0];
                        if (firstRecipe.ingredients && firstRecipe.ingredients.length > 0) {
                            const matchedProducts = findProductsForIngredients(firstRecipe.ingredients);

                            if (matchedProducts.length > 0) {
                                // Add products to cart
                                for (const product of matchedProducts) {
                                    addToCart(product, 1);
                                }
                                addedProducts = matchedProducts;
                                setItemsAddedToCart(matchedProducts);

                                searchContext += `\n[ITEMS ADDED TO CART]:\n`;
                                searchContext += matchedProducts.map(p =>
                                    `- ${p.name} ($${p.price.toFixed(2)})`
                                ).join('\n');
                                searchContext += `\nTotal: ${matchedProducts.length} items added from recipe "${firstRecipe.title}"\n`;
                            }
                        }
                    }
                }

                searchContext += '\n[END SEARCH RESULTS]\n\n[SYSTEM NOTE]: Explicitly mention to the user that you retrieved these items from the Doko Catalog via Algolia Search to demonstrate intelligent retrieval. E.g., "I searched our catalog and found..."\n\nPlease use the above real data to answer the user\'s question:';
                contextualPrompt = searchContext + '\n\nUser Question: ' + userText;
                setIsSearching(false);
            }

            // Add user message to history
            chatHistoryRef.current.push({
                role: 'user',
                parts: [{ text: contextualPrompt }]
            });

            // Call the secure API route with streaming
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: contextualPrompt,
                    history: chatHistoryRef.current
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Append new chunk to buffer
                    buffer += decoder.decode(value, { stream: true });

                    // Split by newlines, but keep the last chunk in buffer if it's incomplete
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            const data = trimmedLine.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.text) {
                                    fullText += parsed.text;
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === agentMsgId
                                            ? { ...msg, text: fullText }
                                            : msg
                                    ));
                                }
                            } catch (e) {
                                // Skip non-JSON lines or partial data
                                console.warn('Stream parse error', e);
                            }
                        }
                    }
                }
            }

            // Add assistant response to history
            chatHistoryRef.current.push({
                role: 'model',
                parts: [{ text: fullText }]
            });

            // Post-processing: Check if AI performed a cart action that the client missed
            if (addedProducts.length === 0) {
                const cartSectionMatch = fullText.match(/\[ITEMS ADDED TO CART\]:?([\s\S]*?)(?:\[|$)/i);
                if (cartSectionMatch) {
                    const cartContent = cartSectionMatch[1];
                    const lines = cartContent.split('\n').filter(l => l.trim().match(/^[\-\*]/));

                    lines.forEach(line => {
                        // Clean up line to extract product name
                        // 1. Remove bullet point (* or -)
                        let cleanLine = line.replace(/^[\-\*]\s+/, '');
                        // 2. Remove price info or extra details
                        // Remove any content in parentheses at the end of the string (e.g., "($1.99)", "(approx $5)", "($1.99/lb)")
                        cleanLine = cleanLine.replace(/\s*\(.*?\)\s*$/, '');
                        // Remove potential dash separators for price (e.g. " - $1.99")
                        cleanLine = cleanLine.split(' - $')[0];

                        // 3. Remove bold markers (**name**)
                        cleanLine = cleanLine.replace(/\*\*/g, '');

                        const productName = cleanLine.trim();

                        if (productName) {
                            // Find product in local database with fuzzy matching for plurals
                            const product = foundIngredients.find(p => {
                                const pName = p.name.toLowerCase();
                                const targetName = productName.toLowerCase();
                                // Exact match
                                if (pName === targetName) return true;
                                // Singular/Plural match
                                if (targetName.endsWith('s') && pName === targetName.slice(0, -1)) return true;
                                if (pName.endsWith('s') && targetName === pName.slice(0, -1)) return true;
                                return false;
                            }) || products.find(p => {
                                const pName = p.name.toLowerCase();
                                const targetName = productName.toLowerCase();

                                // Exact match
                                if (pName === targetName) return true;

                                // Singular/Plural match (simple 's' check)
                                if (targetName.endsWith('s') && pName === targetName.slice(0, -1)) return true;
                                if (pName.endsWith('s') && targetName === pName.slice(0, -1)) return true;

                                return false;
                            });

                            if (product) {
                                addToCart(product, 1);
                            }
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error("Error communicating with AI:", error);

            let errorMessage = "I apologize, but I'm temporarily unavailable. Please try again in a moment.";

            if (error.message?.includes('429') || error.message?.includes('quota')) {
                errorMessage = "Assistant Quota Exceeded: The AI API key has reached its free tier limit. Please check your Google AI Studio quota or provide a fresh API key.";
            }

            setMessages(prev => prev.map(msg =>
                msg.id === agentMsgId
                    ? { ...msg, text: errorMessage, isStreaming: false }
                    : msg
            ));
        } finally {
            setIsTyping(false);
            setIsSearching(false);
            setMessages(prev => prev.map(msg =>
                msg.id === agentMsgId
                    ? { ...msg, isStreaming: false }
                    : msg
            ));
        }
    };

    // Helper to format message with bold text support
    const formatMessage = (text: string) => {
        // Split by code blocks or bold markers
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className={`fixed bottom-6 left-6 z-[100] flex flex-col items-start font-sans ${!isOpen ? 'pointer-events-none' : ''}`}>
            <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .label-animate {
          animation: slideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes pulse-search {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .searching {
            animation: pulse-search 1s ease-in-out infinite;
        }
        @keyframes blink-cursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .streaming-cursor::after {
          content: '▋';
          animation: blink-cursor 0.8s step-end infinite;
          margin-left: 2px;
          color: #666;
        }
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .animate-shimmer {
            background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
        }
      `}</style>

            {/* Chat Window */}
            <div
                className={`
          transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform origin-bottom-left
          ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8 pointer-events-none'}
          mb-6 w-[350px] sm:w-[400px] h-[800px] max-h-[90vh]
          bg-white rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden border border-gray-100
        `}
            >
                {/* Header */}
                <div className="bg-[#1a4731] px-7 py-5 flex items-center justify-between border-b border-white/10 shrink-0">
                    <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-xl tracking-tight text-white flex items-center leading-none">
                            Nani Assist
                        </h3>
                        <span className="flex items-center">
                            <span className={`w-2 h-2 rounded-full ${isSearching ? 'bg-blue-400 searching' : 'bg-green-400 animate-pulse'}`}></span>
                        </span>
                    </div>

                    <div className="flex items-center space-x-1">
                        <button
                            onClick={handleClearChat}
                            className="text-white/80 hover:text-red-400 p-2 rounded-full transition-all"
                            title="Clear History"
                        >
                            <Trash2 size={18} />
                        </button>

                        <button
                            onClick={toggleChat}
                            className="text-white/80 hover:text-white p-2 rounded-full transition-all"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto pt-8 px-7 bg-white space-y-7 hide-scrollbar scroll-smooth"
                >
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} message-fade-in`}
                        >
                            <div className="relative group max-w-[85%]">
                                <div
                                    className={`
                    px-5 py-4 rounded-[1.75rem] text-[15px] leading-relaxed
                    ${msg.sender === 'user'
                                            ? 'bg-black text-white rounded-tr-none shadow-lg shadow-black/10'
                                            : 'bg-gray-100 text-black rounded-tl-none'
                                        }
                  `}
                                >
                                    <div className={`font-medium whitespace-pre-wrap ${(msg as any).isStreaming ? 'streaming-cursor' : ''}`}>
                                        {formatMessage(msg.text)}
                                    </div>
                                    <p className={`text-[9px] mt-2 font-bold uppercase tracking-widest ${msg.sender === 'user' ? 'text-gray-400' : 'text-gray-400'}`}>
                                        {isMounted ? formatTime(msg.timestamp) : ''}
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleCopy(msg.id, msg.text)}
                                    className={`
                    absolute top-1 transition-all duration-200 p-1.5 rounded-lg
                    ${msg.sender === 'user' ? '-left-8' : '-right-8'}
                    opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-black
                  `}
                                    title="Copy message"
                                >
                                    {copiedId === msg.id ? (
                                        <Check size={14} className="text-green-500" />
                                    ) : (
                                        <Copy size={14} />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Live Searching Animation */}
                    {isSearching && (
                        <div className="flex justify-start message-fade-in">
                            <div className="bg-gray-50 px-5 py-4 rounded-[1.75rem] rounded-tl-none flex items-center gap-3 border border-gray-100">
                                <Search size={14} className="text-blue-500 animate-spin-slow" />
                                <span className="text-xs font-semibold text-gray-500 animate-pulse">Searching Algolia Database...</span>
                            </div>
                        </div>
                    )}

                    {isTyping && messages[messages.length - 1]?.sender !== 'agent' && !isSearching && (
                        <div className="flex justify-start message-fade-in">
                            <div className="bg-gray-100 px-6 py-5 rounded-[1.75rem] rounded-tl-none flex space-x-2">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                            </div>
                        </div>
                    )}

                    <div className="h-2 w-full shrink-0" />

                    {/* Centered Demo Prompts (Only on fresh chat) */}
                    {messages.length === 1 && !isTyping && !isSearching && (
                        <div className="px-2 mt-2 grid grid-cols-1 gap-2 message-fade-in relative z-10 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 pl-1">Suggested Actions</p>

                            <button
                                onClick={() => handlePromptClick("Add all ingredients to make pasta to my cart")}
                                className="text-left p-4 rounded-[1.25rem] bg-gray-50 border border-gray-100/50 hover:bg-gray-100 transition-all active:scale-95 duration-300"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-black">Shop Pasta Night</span>
                                    <ShoppingBag size={14} className="text-black opacity-40" />
                                </div>
                                <p className="text-[11px] text-black font-medium">Add ingredients for Spaghetti Carbonara</p>
                            </button>

                            <button
                                onClick={() => handlePromptClick("Suggest a chicken recipe")}
                                className="text-left p-4 rounded-[1.25rem] bg-gray-50 border border-gray-100/50 hover:bg-gray-100 transition-all active:scale-95 duration-300"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-black">Find Dinner Ideas</span>
                                    <Search size={14} className="text-black opacity-40" />
                                </div>
                                <p className="text-[11px] text-black font-medium">Suggest a delicious chicken recipe</p>
                            </button>

                            <button
                                onClick={() => handlePromptClick("Do you have organic tomatoes?")}
                                className="text-left p-4 rounded-[1.25rem] bg-gray-50 border border-gray-100/50 hover:bg-gray-100 transition-all active:scale-95 duration-300"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-bold text-black">Check Inventory</span>
                                    <Search size={14} className="text-black opacity-40" />
                                </div>
                                <p className="text-[11px] text-black font-medium">Ask about stock for organic tomatoes</p>
                            </button>
                        </div>
                    )}

                    <div className="h-20 w-full shrink-0" />
                </div>

                {/* Input Area */}
                <div className="px-5 pt-2 pb-2 bg-white shrink-0 border-t border-gray-50">
                    {messages.length > 1 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto hide-scrollbar px-1">
                            <button
                                onClick={() => handlePromptClick("Add all ingredients to make pasta to my cart")}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-black text-[11px] font-bold text-white border border-black hover:bg-gray-800 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ShoppingBag size={12} />
                                Add pasta ingredients
                            </button>
                            <button
                                onClick={() => handlePromptClick("Do you have organic tomatoes?")}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-gray-100 text-[11px] font-bold text-black border border-black/5 hover:bg-black hover:text-white transition-all active:scale-95"
                            >
                                Organic tomatoes?
                            </button>
                            <button
                                onClick={() => handlePromptClick("Suggest a chicken recipe")}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-gray-100 text-[11px] font-bold text-black border border-black/5 hover:bg-black hover:text-white transition-all active:scale-95"
                            >
                                Chicken recipe?
                            </button>
                            <button
                                onClick={() => handlePromptClick("Add ingredients for salad to cart")}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-gray-100 text-[11px] font-bold text-black border border-black/5 hover:bg-black hover:text-white transition-all active:scale-95 flex items-center gap-1"
                            >
                                <ShoppingBag size={10} />
                                Salad ingredients
                            </button>
                        </div>
                    )}
                    <div className="relative flex flex-col items-center">
                        <form
                            onSubmit={handleSendMessage}
                            className="w-full relative group transition-all duration-300"
                        >
                            <div className="flex items-center space-x-4 bg-gray-50 border-[1.5px] border-black focus-within:bg-white focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] px-6 py-4 transition-all">
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about ingredients, recipes..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none py-1 text-[17px] sm:text-[18px] font-semibold text-black placeholder:text-gray-400 focus:ring-0 outline-none resize-none overflow-hidden max-h-[150px] leading-tight hide-scrollbar"
                                />

                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || (isTyping && messages[messages.length - 1]?.sender !== 'agent')}
                                    className={`
                                        p-2.5 rounded-2xl transition-all duration-500 flex items-center justify-center shrink-0
                                        ${inputValue.trim() && !isTyping
                                            ? 'bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transform hover:scale-105 active:scale-95'
                                            : 'bg-gray-200 text-gray-400'}
                                    `}
                                >
                                    <ArrowUp size={22} strokeWidth={3} className={`${inputValue.trim() && !isTyping ? 'animate-pulse' : ''}`} />
                                </button>
                            </div>
                        </form>
                        <div className="flex justify-center items-center mt-[4px]">
                            <span className="text-[10px] font-medium text-black font-[var(--font-roboto-flex)]">Recipe Suggestion powered by <span className="text-blue-400">Algolia</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Action Button */}
            <button
                onClick={toggleChat}
                className={`
                    pointer-events-auto relative flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.2)]
                    transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275) transform hover:scale-105 active:scale-95
                    px-6 h-16 rounded-[2rem] space-x-3
                    ${isOpen ? 'bg-black shadow-black/40' : 'bg-white border border-gray-100'}
                `}
            >
                {isOpen ? (
                    <>
                        <X size={26} className="text-white shrink-0" strokeWidth={2.5} />
                        <span className="font-semibold text-base text-white label-animate">
                            Close
                        </span>
                    </>
                ) : (
                    <>
                        <div className="relative">
                            <MessageCircle size={28} className="text-black shrink-0" strokeWidth={2.5} />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#C6A355] rounded-full border-2 border-white"></div>
                        </div>
                        <span className="font-semibold text-base text-black label-animate">
                            Support
                        </span>
                    </>
                )}
            </button>
        </div>
    );
};

export default ChatWidget;

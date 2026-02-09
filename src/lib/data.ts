import { Product, Category, DietaryTag } from './types';
import rawIngredients from '../../public/ingredients_final.json';

// Helper to map JSON category strings to enum values
const mapCategory = (name: string, cat: string): Category => {
    const combined = (name + ' ' + cat).toLowerCase();

    if (combined.includes('fruit') || combined.includes('berry') || combined.includes('apple') || combined.includes('banana')) {
        return Category.FRUITS;
    }

    if (combined.includes('produce') || combined.includes('veg')) {
        return Category.VEGETABLES;
    }

    if (combined.includes('dairy') || combined.includes('cheese') || combined.includes('milk')) return Category.DAIRY;
    if (combined.includes('snack') || combined.includes('sweet') || combined.includes('candy') || combined.includes('chocolate')) return Category.SNACKS;

    if (combined.includes('pantry') || combined.includes('spice') || combined.includes('meat') || combined.includes('oil') || combined.includes('sauce') || combined.includes('canned') || combined.includes('grain') || combined.includes('bread') || combined.includes('pasta') || combined.includes('rice')) {
        return Category.PANTRY;
    }

    return Category.OTHER; // Default for miscellaneous items

};

// Mock Recipes for Fallback
export const mockRecipes = [
    {
        objectID: 'fallback-1',
        title: 'Spaghetti Carbonara',
        ingredients: ['Spaghetti', 'Eggs', 'Pecorino Romano', 'Guanciale', 'Black Pepper'],
        instructions: 'Cook pasta. Mix eggs and cheese. Fry guanciale. Combine.',
        cookTime: '20 mins',
        image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&q=80&w=800',
    },
    {
        objectID: 'fallback-2',
        title: 'Simple Chicken Salad',
        ingredients: ['Chicken Breast', 'Lettuce', 'Tomato', 'Cucumber', 'Olive Oil', 'Lemon'],
        instructions: 'Grill chicken. Chop vegetables. Toss with dressing.',
        cookTime: '15 mins',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800',
    },
    {
        objectID: 'fallback-3',
        title: 'Classic Pancakes',
        ingredients: ['Flour', 'Milk', 'Egg', 'Sugar', 'Butter', 'Baking Powder'],
        instructions: 'Mix dry ingredients. Add wet ingredients. Cook on griddle.',
        cookTime: '20 mins',
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=800',
    },
    {
        objectID: 'fallback-4',
        title: 'Vegetable Stir Fry',
        ingredients: ['Broccoli', 'Carrot', 'Bell Pepper', 'Soy Sauce', 'Ginger', 'Garlic'],
        instructions: 'Stir fry vegetables in hot wok with sauce.',
        cookTime: '15 mins',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    },
    {
        objectID: 'fallback-5',
        title: 'Beef Tacos',
        ingredients: ['Ground Beef', 'Taco Shells', 'Lettuce', 'Cheese', 'Salsa', 'Onion'],
        instructions: 'Cook beef with spices. Fill tacos.',
        cookTime: '25 mins',
        image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=800',
    }
];

// Priority list for "Better" options
const POPULAR_ITEMS = [
    'Tomato', 'Potato', 'Onion', 'Garlic', 'Carrot', 'Spinach', 'Broccoli', 'Cucumber', 'Pumpkin', 'Cabbage', // Veg
    'Apple', 'Banana', 'Orange', 'Strawberry', 'Grape', 'Lemon', 'Lime', 'Mango', // Fruits
    'Milk', 'Butter', 'Cheese', 'Yogurt', 'Cream', 'Egg', // Dairy
    'Chicken', 'Beef', 'Pork', 'Fish', 'Meat', // Meats
    'Rice', 'Pasta', 'Bread', 'Flour', 'Oil', 'Salt', 'Sugar', 'Honey', 'Coffee', 'Tea', 'Water', // Pantry
    'Chocolate', 'Chip', 'Cookie', 'Nut', 'Popcorn', 'Cracker' // Snacks
];

// Sort ingredients to prioritize popular ones
const sortedIngredients = (rawIngredients as any[]).sort((a: any, b: any) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Check if matches any popular item
    const aPopular = POPULAR_ITEMS.find(k => aName.includes(k.toLowerCase()));
    const bPopular = POPULAR_ITEMS.find(k => bName.includes(k.toLowerCase()));

    // If both popular, prioritize shorter names (likely closer to "Whole" item)
    if (aPopular && bPopular) {
        if (aName.length !== bName.length) return aName.length - bName.length;
        return 0;
    }

    // If one is popular, prioritize it
    if (aPopular) return -1;
    if (bPopular) return 1;

    return 0;
});

// Deterministic hash function to generate consistent "random" values from a string
const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// Seeded random number generator based on product ID
const seededRandom = (seed: string, offset: number = 0): number => {
    const hash = hashString(seed + offset.toString());
    return (hash % 10000) / 10000; // Returns 0-1
};

// Use sorted list with deterministic values to avoid hydration mismatch
export const products: Product[] = sortedIngredients.slice(0, 2000).map((ing: any) => {
    const id = ing.objectID;
    return {
        id,
        name: ing.name,
        price: Math.floor(seededRandom(id, 1) * 15) + 1.99,
        category: mapCategory(ing.name, ing.category || 'Pantry'),
        image: `https://tse2.mm.bing.net/th?q=${encodeURIComponent(ing.name + ' ' + (ing.category || 'food'))}&w=800&h=800&c=7&rs=1&p=0`,
        rating: 4.0 + seededRandom(id, 2),
        reviews: Math.floor(seededRandom(id, 3) * 200),
        isNew: seededRandom(id, 4) > 0.8,
        dietary: [DietaryTag.ORGANIC],
        description: ing.name + ' - Fresh and high quality ingredient sourced for your kitchen.',
        popularity: Math.floor(seededRandom(id, 5) * 100),
        dateAdded: '2024-01-01T00:00:00.000Z' // Fixed date to avoid hydration issues
    };
});

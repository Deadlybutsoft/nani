'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Product, CartItem, Order, Recipe } from '@/lib/types';
import { products } from '@/lib/data';

interface StoreContextType {
    cart: CartItem[];
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;

    // Direct Buy
    buyNow: (product: Product, quantity?: number) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Wishlist / Saved Items
    wishlist: string[];
    toggleWishlist: (productId: string) => void;
    isInWishlist: (productId: string) => boolean;

    savedRecipes: Recipe[];
    toggleSaveRecipe: (recipe: Recipe) => void;
    isRecipeSaved: (recipeId: string) => boolean;

    // Orders
    orders: Order[];
    addOrder: (order: Order) => void;

    // Router
    currentRoute: string;
    navigate: (path: string) => void;

    // Data access
    getProduct: (id: string) => Product | undefined;
    allProducts: Product[];

    // UI State
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    isWishlistOpen: boolean;
    setIsWishlistOpen: (isOpen: boolean) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);

    // Load Cart from LocalStorage on Mount
    React.useEffect(() => {
        const savedCart = localStorage.getItem('doko-cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error('Failed to parse cart', e);
            }
        }
    }, []);

    // Save Cart to LocalStorage on Change
    React.useEffect(() => {
        localStorage.setItem('doko-cart', JSON.stringify(cart));
    }, [cart]);

    // New State
    const [searchQuery, setSearchQuery] = useState('');
    const [wishlist, setWishlist] = useState<string[]>([]);
    const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);

    const navigate = (path: string) => {
        router.push(path);
    };

    const addToCart = (product: Product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
        setIsCartOpen(true);
    };

    const buyNow = (product: Product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
        setIsCartOpen(false); // Ensure cart drawer is closed
        navigate('/checkout');
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, quantity } : item
        ));
    };

    const clearCart = () => setCart([]);

    // Wishlist Logic for Products
    const toggleWishlist = (productId: string) => {
        setWishlist(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const isInWishlist = (productId: string) => wishlist.includes(productId);

    // Recipe Saving Logic
    const toggleSaveRecipe = (recipe: Recipe) => {
        setSavedRecipes(prev =>
            prev.find(r => r.objectID === recipe.objectID)
                ? prev.filter(r => r.objectID !== recipe.objectID)
                : [...prev, recipe]
        );
    };

    const isRecipeSaved = (recipeId: string) => savedRecipes.some(r => r.objectID === recipeId);

    // Order Logic
    const addOrder = (order: Order) => {
        setOrders(prev => [order, ...prev]);
    };

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

    const getProduct = (id: string) => products.find(p => p.id === id);

    return (
        <StoreContext.Provider value={{
            cart,
            addToCart,
            buyNow,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartTotal,
            cartCount,
            searchQuery,
            setSearchQuery,
            wishlist,
            toggleWishlist,
            isInWishlist,
            savedRecipes,
            toggleSaveRecipe,
            isRecipeSaved,
            orders,
            addOrder,
            currentRoute: pathname,
            navigate,
            getProduct,
            allProducts: products,
            isCartOpen,
            setIsCartOpen,
            isWishlistOpen,
            setIsWishlistOpen
        }}>
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

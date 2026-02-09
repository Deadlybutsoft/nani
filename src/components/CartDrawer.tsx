'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Icons } from './Icon';
import { Button, SafeImage } from './ui';
import { algoliasearch } from 'algoliasearch';

const client = algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
);

export const CartDrawer: React.FC = () => {
    const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal, navigate } = useStore();
    const drawerRef = useRef<HTMLDivElement>(null);
    const [suggestedRecipes, setSuggestedRecipes] = useState<any[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node) && isCartOpen) {
                setIsCartOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCartOpen, setIsCartOpen]);

    useEffect(() => {
        if (isCartOpen) {
            document.body.style.overflow = 'hidden';
            if (cart.length > 0) {
                fetchRecipes();
            } else {
                setSuggestedRecipes([]);
            }
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isCartOpen, cart]);

    const fetchRecipes = async () => {
        try {
            if (cart.length === 0) {
                setSuggestedRecipes([]);
                return;
            }

            // Get cart item names (these are the ingredients we have)
            const cartIngredients = cart.map(i => i.name.toLowerCase());

            // Perform parallel searches for the top 3 items to get a diverse set of recipes
            const searchItems = cart.slice(0, 3).map(i => i.name);
            const searchRequests = searchItems.map(item => ({
                indexName: 'food',
                query: item,
                hitsPerPage: 15
            }));

            const res: any = await client.search({ requests: searchRequests });

            // Flatten all hits from individual queries and deduplicate by objectID
            const allHits = res.results.flatMap((result: any) => result.hits || []);
            const uniqueHits = Array.from(new Map(allHits.map((hit: any) => [hit.objectID, hit])).values());

            if (uniqueHits.length > 0) {
                // Score each recipe by how many of its ingredients match cart items
                const scoredRecipes = uniqueHits.map((recipe: any) => {
                    const recipeIngredients = recipe.ingredients || [];
                    let matchCount = 0;

                    recipeIngredients.forEach((ing: string) => {
                        const ingLower = ing.toLowerCase();
                        if (cartIngredients.some(cartIng =>
                            ingLower.includes(cartIng) || cartIng.includes(ingLower)
                        )) {
                            matchCount++;
                        }
                    });

                    return { ...recipe, matchCount };
                });

                // Sort by match count (highest first)
                const sortedRecipes = scoredRecipes
                    .filter((r: any) => r.matchCount > 0)
                    .sort((a: any, b: any) => b.matchCount - a.matchCount)
                    .slice(0, 10);

                if (sortedRecipes.length > 0) {
                    setSuggestedRecipes(sortedRecipes);
                    return;
                }
            }
        } catch (error) {
            console.error('Error fetching recipes from Algolia:', error);
        }

        // Fallback: Use local mock recipes and score by ingredient match
        const { mockRecipes } = await import('@/lib/data');
        const cartIngredients = cart.map(i => i.name.toLowerCase());

        const scoredMock = mockRecipes.map(recipe => {
            let matchCount = 0;
            recipe.ingredients.forEach(ing => {
                const ingLower = ing.toLowerCase();
                if (cartIngredients.some(cartIng =>
                    ingLower.includes(cartIng) || cartIng.includes(ingLower)
                )) {
                    matchCount++;
                }
            });
            return { ...recipe, matchCount };
        });

        const sorted = scoredMock
            .filter(r => r.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount);

        setSuggestedRecipes(sorted);
    };

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-sm transition-opacity">
            <div
                ref={drawerRef}
                className="w-full sm:w-1/2 min-w-[320px] bg-[#062016] h-full shadow-2xl flex flex-col transform transition-transform animate-slide-in-right border-l border-white/5"
            >
                <div className="p-6 flex items-center justify-between border-b border-white/5">
                    <h2 className="text-lg font-display font-bold text-brand-secondary">Shopping Bag</h2>
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="p-2 hover:bg-white/5 rounded-lg transition-all text-brand-secondary"
                    >
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <Icons.Bag className="w-12 h-12 text-brand-secondary mb-4 opacity-20" />
                            <p className="text-brand-secondary/40 text-sm">Your bag is empty.</p>
                            <button
                                onClick={() => setIsCartOpen(false)}
                                className="mt-4 text-xs font-bold border-b border-brand-secondary text-brand-secondary pb-1"
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-4">
                                <div className="w-20 h-24 bg-zinc-50 rounded-lg overflow-hidden flex-shrink-0">
                                    <SafeImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 flex flex-col py-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="text-sm font-medium text-brand-secondary">{item.name}</h3>
                                        <button onClick={() => removeFromCart(item.id)} className="text-brand-secondary/40 hover:text-brand-secondary transition-colors">
                                            <Icons.Close className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs font-bold mb-auto text-brand-secondary">${item.price.toFixed(2)}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center border border-white/10 rounded-lg bg-white/5">
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1.5 hover:text-brand-secondary text-brand-secondary/60"><Icons.Minus className="w-3 h-3" /></button>
                                            <span className="w-6 text-center text-xs font-bold text-brand-secondary">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1.5 hover:text-brand-secondary text-brand-secondary/60"><Icons.Plus className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="p-6 border-t border-white/5 space-y-4 bg-[#062016]">
                        {/* Recipe Suggestions */}
                        {suggestedRecipes.length > 0 && (
                            <div className="mb-6 group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Icons.Leaf className="w-4 h-4 text-[#C6A355]" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#C6A355]">Cook with your items</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => document.getElementById('recipe-scroll')?.scrollBy({ left: -200, behavior: 'smooth' })}
                                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-brand-secondary transition-colors"
                                        >
                                            <Icons.Back className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => document.getElementById('recipe-scroll')?.scrollBy({ left: 200, behavior: 'smooth' })}
                                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-brand-secondary transition-colors"
                                        >
                                            <Icons.Back className="w-3 h-3 rotate-180" />
                                        </button>
                                    </div>
                                </div>
                                <div id="recipe-scroll" className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                                    {suggestedRecipes.map(recipe => (
                                        <div
                                            key={recipe.objectID}
                                            onClick={() => {
                                                setIsCartOpen(false);
                                                navigate(`/recipe/${recipe.objectID}`);
                                            }}
                                            className="min-w-[200px] p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                                        >
                                            <h4 className="text-sm font-medium text-brand-secondary line-clamp-1 mb-1">{recipe.title}</h4>
                                            <p className="text-[10px] text-brand-secondary/60 truncate">
                                                {recipe.ingredients.length} ingredients
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-end">
                            <span className="text-sm text-brand-secondary/60">Total</span>
                            <span className="text-xl font-bold text-brand-secondary">${cartTotal.toFixed(2)}</span>
                        </div>
                        <Button
                            fullWidth
                            size="lg"
                            className="rounded-xl"
                            onClick={() => {
                                setIsCartOpen(false);
                                navigate('/checkout');
                            }}
                        >
                            Checkout
                        </Button>
                        <p className="text-[10px] text-brand-secondary/30 text-center uppercase tracking-widest">Shipping calculated at checkout</p>
                    </div>
                )}
            </div>
        </div>
    );
};

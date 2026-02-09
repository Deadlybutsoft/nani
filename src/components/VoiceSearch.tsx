import {
    useConversation,
    Role,
} from '@elevenlabs/react';
import React, { useCallback, useState } from 'react';
import { Icons } from './Icon';
import { useStore } from '@/context/StoreContext';
import { Product } from '@/lib/types';
import { products } from '@/lib/data';

interface VoiceSearchProps {
    onSearch?: (query: string) => void;
}

export function VoiceSearch({ onSearch }: VoiceSearchProps) {
    const { addToCart, navigate } = useStore();
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState<string>('');

    // 1. Dynamic Keyterm Generation (Concept for Hackathon)
    // We prioritize popular products to ensure accuracy for common items
    // (In production, these would be passed to the agent configuration)

    const conversation = useConversation({
        onConnect: () => {
            setStatus('Listening...');
            setIsListening(true);
        },
        onDisconnect: () => {
            setStatus('');
            setIsListening(false);
        },
        onMessage: (message: any) => {
            // We only care about user input for entity detection
            if (message.source === 'user') {
                console.log('User said:', message.message);
            }
        },
        onError: (error: any) => {
            console.error('Voice error:', error);
            setStatus('Error');
        },
        // 2. Client Tools (Function Calling / Entity Detection)
        // Scribe v2 detects these "intents" and calls our client-side functions
        clientTools: {
            addToCart: (parameters: { productName: string; quantity: number, unit?: string }) => {
                const { productName, quantity } = parameters;
                console.log('Detected Intent: Add to Cart', productName, quantity);

                // Find product with fuzzy matching
                const product = products.find(p => p.name.toLowerCase().includes(productName.toLowerCase()));

                if (product) {
                    addToCart(product, quantity || 1);
                    setStatus(`Added ${quantity || 1} ${productName}`);
                    return `Added ${quantity || 1} ${product.name} to your cart.`;
                } else {
                    // Fallback search if exact match fails
                    if (onSearch) onSearch(productName);
                    navigate(`/?search=${encodeURIComponent(productName)}`);
                    return `Searching for ${productName}`;
                }
            },
            searchProduct: (parameters: { query: string }) => {
                const { query } = parameters;
                console.log('Detected Intent: Search', query);
                if (onSearch) onSearch(query);
                // Also update URL/Store state
                useStore().setSearchQuery(query);
                return `Showing results for ${query}`;
            }
        }
    });

    const startListening = useCallback(async () => {
        try {
            // 3. Request Session with Dynamic Keyterms
            // In a real implementation, you would fetch a signed URL from your backend
            // that includes these overrides. For the hackathon client-side demo, 
            // we pass them if the SDK supports direct overrides or assume the Agent 
            // is pre-configured with a broad "Grocery" knoweldge base.

            // Note: The React SDK connects to a configured Agent.
            // To create "Dynamic Prompting", the best Hackathon hack is to 
            // use the 'clientTools' to guide the conversation, as the Agent 
            // will try to fill the tool parameters (productName) which acts as a strong bias.

            await conversation.startSession({
                agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
            } as any);
        } catch (error) {
            console.error('Failed to start conversation:', error);
        }
    }, [conversation]);

    const stopListening = useCallback(async () => {
        await conversation.endSession();
    }, [conversation]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {status && (
                <div className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md animate-fade-in border border-white/10">
                    {status}
                </div>
            )}

            <button
                onClick={isListening ? stopListening : startListening}
                className={`
          flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300
          ${isListening
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110'
                        : 'bg-brand-accent hover:bg-brand-accent/90 hover:scale-105'
                    }
        `}
            >
                {isListening ? (
                    <div className="w-4 h-4 bg-white rounded-sm" />
                ) : (
                    <Icons.Mic className="w-6 h-6 text-white" />
                )}
            </button>
        </div>
    );
}

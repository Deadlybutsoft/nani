import { GoogleGenAI } from '@google/genai';
import { NextRequest } from 'next/server';

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
    *   *Example*: "I've added the necessary ingredients (Guanciale, Pecorino, Spaghetti) to your cart."

- **[NO RESULTS]**:
    *   *Action*: Use your general culinary knowledge to guide the user back to valid paths.
    *   *Example*: "I couldn't find a specific recipe for 'Moon Rock Soup', but our inventory has excellent ingredients for traditional stone soups or root vegetable stews. Should we explore those?"

OPERATIONAL RULES:
- **Be Agentic**: Don't just answer; propose the next step. "Shall I add these ingredients to your cart?"
- **Be Concise but Expert**: Speak with the confidence of a Michelin-star chef who is also a data scientist.
- **Never Hallucinate Inventory**: If it's not in [PRODUCTS FOUND], don't say we sell it. Instead, say "I can look for a substitute."
- **Formatting**: Use bolding for **Product Names** and *Recipe Titles* to make them stand out.

CRITICAL PROTOCOL - READ CAREFULLY:
The user interface is completely dependent on YOU outputting the specific data blocks to trigger actions.

IF THE USER SAYS "ADD TO CART" OR "BUY THIS":
1. You MUST output the "**[ITEMS ADDED TO CART]**" block.
2. Inside that block, list the EXACT product names as they appeared in [PRODUCTS FOUND].
3. If you say "I have added it" but do not output the block, THE CART WILL REMAIN EMPTY and the system will fail.
4. ALWAYS include the block if you intend to add items.`;

export async function POST(request: NextRequest) {
    try {
        const { message, history } = await request.json();

        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            return Response.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Create chat with history
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: SYSTEM_PROMPT,
            },
            history: history || [],
        });

        // Use streaming
        const result = await chat.sendMessageStream({ message });

        // Create a readable stream for the response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result) {
                        const text = chunk.text;
                        if (text) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                        }
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Chat API error:', error);

        if (error.message?.includes('429') || JSON.stringify(error).includes('429')) {
            return Response.json(
                { error: 'API quota exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        return Response.json(
            { error: 'Failed to process chat request' },
            { status: 500 }
        );
    }
}

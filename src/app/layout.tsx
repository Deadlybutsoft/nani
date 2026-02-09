import type { Metadata } from "next";
import { Inter, Roboto_Flex, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { WishlistDrawer } from "@/components/WishlistDrawer";
import ChatWidget from "@/components/ChatWidget";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const robotoFlex = Roboto_Flex({ subsets: ["latin"], variable: "--font-roboto-flex" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: "Nani - Luxury Grocery",
  description: "Experience premium culinary ingredients delivered to your door.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${robotoFlex.variable} ${spaceGrotesk.variable} font-sans bg-premium-bg text-brand-secondary antialiased`}>
        <StoreProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <footer className="bg-black overflow-hidden py-10">
              <div className="w-full flex justify-center items-center">
                <h2 className="font-display font-black text-[22vw] leading-none tracking-tighter text-white select-none whitespace-nowrap">
                  Nani
                </h2>
              </div>
            </footer>
            <CartDrawer />
            <WishlistDrawer />
            <ChatWidget />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}

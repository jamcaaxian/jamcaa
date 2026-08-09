import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeScript } from "@/components/theme-script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "jamcaa", description: "Documentation for the jamcaa content framework" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
                <ThemeScript />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <TooltipProvider delay={300}>{children}</TooltipProvider>
            </body>
        </html>
    );
}

import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import { publicSiteMetadata } from "@/content/public-site";
import { siteThemeCss } from "@/content/theme";
import { ThemeScript } from "@/components/theme-script";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return publicSiteMetadata();
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    let themeCss = "";

    try {
        const { env } = getCloudflareContext();
        themeCss = await siteThemeCss(createDatabase(env.DB));
    } catch {
        // Outside a request context (rare) or a broken binding: keep the static theme.
    }

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
                <link rel="alternate" type="application/feed+json" href="/feed.json" />
                {themeCss ?
                    <style dangerouslySetInnerHTML={{ __html: themeCss }} />
                :   null}
                <ThemeScript />
            </head>
            <body className="antialiased">
                <a
                    href="#main-content"
                    className="bg-background text-foreground focus-visible:ring-ring fixed top-2 left-2 z-100 -translate-y-20 rounded-lg px-3 py-2 text-sm font-medium shadow-lg focus:translate-y-0 focus-visible:ring-3"
                >
                    Skip to content
                </a>
                <TooltipProvider delay={300}>{children}</TooltipProvider>
            </body>
        </html>
    );
}

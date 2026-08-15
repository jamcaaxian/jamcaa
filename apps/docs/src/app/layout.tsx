import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import { docsLocales, localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { publicSiteMetadata } from "@/content/public-site";
import { siteThemeCss } from "@/content/theme";
import { themeScript } from "@/components/theme-script";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return publicSiteMetadata();
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const requestHeaders = await headers();
    const locale = docsLocales.canonical(requestHeaders.get("x-jamcaa-locale") ?? "") ?? docsLocales.defaultLocale;
    const messages = publicCopy(locale);
    let themeCss = "";

    try {
        const { env } = getCloudflareContext();
        themeCss = await siteThemeCss(createDatabase(env.DB));
    } catch {
        // Outside a request context (rare) or a broken binding: keep the static theme.
    }

    return (
        <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
                <link rel="alternate" type="application/feed+json" href={localizedPath(locale, "/feed.json")} />
                {themeCss ?
                    <style dangerouslySetInnerHTML={{ __html: themeCss }} />
                :   null}
                <Script id="jamcaa-theme" strategy="beforeInteractive">
                    {themeScript}
                </Script>
            </head>
            <body className="antialiased">
                <a
                    href="#main-content"
                    className="bg-background text-foreground focus-visible:ring-ring fixed top-2 left-2 z-100 -translate-y-20 rounded-lg px-3 py-2 text-sm font-medium shadow-lg focus:translate-y-0 focus-visible:ring-3"
                >
                    {messages.skipToContent}
                </a>
                <TooltipProvider delay={300}>{children}</TooltipProvider>
            </body>
        </html>
    );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsSiteFooter } from "@/components/public/docs-site-footer";
import { DocsSiteHeader } from "@/components/public/docs-site-header";
import { docsLocaleContext, docsLocales } from "@/content/locales";
import { canAccessConsole } from "@/lib/console-access";

export function generateStaticParams() {
    return docsLocales.definitions.map(definition => ({ locale: definition.urlKey }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        return {};
    }

    return { title: { default: "Jamcaa Docs", template: "%s · Jamcaa Docs" } };
}

export default async function LocalizedLayout({
    children,
    params
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        notFound();
    }

    const showConsole = await canAccessConsole();

    return (
        <div className="flex min-h-dvh flex-col">
            <DocsSiteHeader locale={context.locale} showConsole={showConsole} />
            <div className="flex-1">{children}</div>
            <DocsSiteFooter locale={context.locale} showConsole={showConsole} />
        </div>
    );
}

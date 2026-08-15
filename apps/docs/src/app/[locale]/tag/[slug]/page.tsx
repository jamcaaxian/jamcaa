import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ProgressivePostList } from "@/components/public/progressive-post-list";
import { docsLocaleContext, localeAlternates, localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { publicPostListing } from "@/content/public-listing";
import { publicPostPage } from "@/content/public-listing-page";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const parameters = await params;
    const context = docsLocaleContext(parameters.locale);

    if (context === undefined) {
        return {};
    }

    const path = `/tag/${parameters.slug}`;

    return {
        title: parameters.slug,
        alternates: { canonical: localizedPath(context.locale, path), languages: localeAlternates(path) }
    };
}

export default async function LocalizedTagArchive({
    params,
    searchParams
}: {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ cursor?: string }>;
}) {
    const parameters = await params;
    const context = docsLocaleContext(parameters.locale);

    if (context === undefined) {
        notFound();
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const tag = await taxonomy(database).tagBySlug(parameters.slug);

    if (tag === undefined) {
        notFound();
    }

    const cursor = (await searchParams).cursor;
    const messages = publicCopy(context.locale);
    const [entries, settings] = await Promise.all([
        publicPostPage(() =>
            postSummaries(database).list({ tagId: tag.id, locale: context.locale, limit: 20, cursor })
        ),
        publicSiteSettings()
    ]);
    const path = localizedPath(context.locale, `/tag/${tag.slug}`);
    const listing = publicPostListing(entries, {
        path,
        cursor,
        locale: context.locale,
        tagSlug: tag.slug,
        permalink: settings.get("permalink.post"),
        datePattern: settings.get("format.date"),
        timePattern: settings.get("format.time")
    });

    return (
        <main id="main-content" className="mx-auto min-h-[70dvh] max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
            <header className="mb-12 border-b pb-10">
                <Link href={localizedPath(context.locale)} className="text-primary text-sm font-semibold">
                    Jamcaa Docs
                </Link>
                <p className="text-muted-foreground mt-5 text-sm font-medium">{messages.tag}</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{tag.name}</h1>
            </header>
            <ProgressivePostList
                key={listing.pageAddress}
                initialPage={listing}
                emptyMessage={messages.tagEmpty}
                locale={context.locale}
            />
        </main>
    );
}

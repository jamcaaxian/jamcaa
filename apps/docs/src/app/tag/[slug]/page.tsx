import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabase } from "@jamcaa/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ProgressivePostList } from "@/components/public/progressive-post-list";
import { publicPostListing } from "@/content/public-listing";
import { publicPostPage } from "@/content/public-listing-page";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

export default async function TagArchive({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ cursor?: string }>;
}) {
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const tag = await taxonomy(database).tagBySlug((await params).slug);

    if (tag === undefined) {
        notFound();
    }

    const cursor = (await searchParams).cursor;
    const [entries, settings] = await Promise.all([
        publicPostPage(() => postSummaries(database).list({ tagId: tag.id, limit: 20, cursor })),
        publicSiteSettings()
    ]);
    const listing = publicPostListing(entries, {
        path: `/tag/${tag.slug}`,
        cursor,
        tagSlug: tag.slug,
        permalink: settings.get("permalink.post"),
        datePattern: settings.get("format.date"),
        timePattern: settings.get("format.time")
    });

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-14 sm:px-6 sm:py-24">
            <header className="mb-14 space-y-3">
                <Link href="/" className="text-primary text-sm font-semibold tracking-tight">
                    {settings.get("site.title")}
                </Link>
                <p className="text-muted-foreground text-sm font-medium">Tag</p>
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{tag.name}</h1>
            </header>
            <ProgressivePostList
                key={listing.pageAddress}
                initialPage={listing}
                emptyMessage="No published Posts use this Tag."
            />
        </main>
    );
}

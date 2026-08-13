import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { ProgressivePostList } from "@/components/public/progressive-post-list";
import { publicPostListing } from "@/content/public-listing";
import { publicPostPage } from "@/content/public-listing-page";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
    const { env } = getCloudflareContext();
    const cursor = (await searchParams).cursor;
    const [entries, settings] = await Promise.all([
        publicPostPage(() => postSummaries(createDatabase(env.DB)).list({ limit: 20, cursor })),
        publicSiteSettings()
    ]);
    const siteTitle = settings.get("site.title");
    const siteDescription = settings.get("site.description").trim();
    const listing = publicPostListing(entries, {
        path: "/",
        cursor,
        permalink: settings.get("permalink.post"),
        datePattern: settings.get("format.date"),
        timePattern: settings.get("format.time")
    });

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-14 sm:px-6 sm:py-24">
            <header className="mb-14 space-y-3">
                <Link href="/" className="text-primary text-sm font-semibold tracking-tight">
                    {siteTitle}
                </Link>
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                    Published with the platform.
                </h1>
                <p className="text-muted-foreground max-w-xl text-lg leading-8">
                    {siteDescription
                        || "The documentation site uses the same Collection, Entry, Media, and publishing interfaces it demonstrates."}
                </p>
            </header>

            <ProgressivePostList
                key={listing.pageAddress}
                initialPage={listing}
                emptyMessage="No Posts have been published yet."
            />
        </main>
    );
}

import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { ProgressivePostList } from "@/components/public/progressive-post-list";
import { PageContent } from "@/components/public/page-content";
import { pages } from "@/content/pages-store";
import { publicPostListing } from "@/content/public-listing";
import { publicPostPage } from "@/content/public-listing-page";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
    const { env } = getCloudflareContext();
    const cursor = (await searchParams).cursor;
    const database = createDatabase(env.DB);
    const [entries, settings, homePage] = await Promise.all([
        publicPostPage(() => postSummaries(database).list({ limit: 20, cursor })),
        publicSiteSettings(),
        pages(database).byAddress("/")
    ]);

    if (homePage !== undefined) {
        return <PageContent title={homePage.title} body={homePage.body} />;
    }

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
        <main id="main-content" className="relative mx-auto min-h-dvh max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
            <div
                aria-hidden="true"
                className="bg-primary/8 pointer-events-none absolute -top-24 -right-40 -z-10 h-96 w-96 rounded-full blur-3xl"
            />
            <header className="mb-16 space-y-5">
                <Link
                    href="/"
                    className="text-primary inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
                >
                    <span className="bg-primary/10 rounded-md px-1.5 py-0.5 font-mono text-xs">{siteTitle}</span>
                </Link>
                <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
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

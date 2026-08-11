import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabase } from "@jamcaa/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PostList } from "@/components/public/post-list";
import { NextPageLink } from "@/components/public/next-page-link";
import { publicPostPage } from "@/content/public-listing";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

export default async function CategoryArchive({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ cursor?: string }>;
}) {
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const category = await taxonomy(database).categoryBySlug((await params).slug);

    if (category === undefined) {
        notFound();
    }

    const cursor = (await searchParams).cursor;
    const [entries, settings] = await Promise.all([
        publicPostPage(() => postSummaries(database).list({ categoryId: category.id, limit: 20, cursor })),
        publicSiteSettings()
    ]);

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-14 sm:px-6 sm:py-24">
            <header className="mb-14 space-y-3">
                <Link href="/" className="text-primary text-sm font-semibold tracking-tight">
                    {settings.get("site.title")}
                </Link>
                <p className="text-muted-foreground text-sm font-medium">Category</p>
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{category.name}</h1>
            </header>
            <PostList
                entries={entries.summaries}
                permalink={settings.get("permalink.post")}
                datePattern={settings.get("format.date")}
                timePattern={settings.get("format.time")}
                emptyMessage="No published Posts belong directly to this Category."
            />
            <NextPageLink path={`/category/${category.slug}`} cursor={entries.nextCursor} />
        </main>
    );
}

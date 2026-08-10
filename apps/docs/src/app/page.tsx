import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { formatMoment } from "@jamcaa/core/dates";
import { postAddress } from "@/content/public-paths";
import { publicSiteSettings } from "@/content/public-site";
import { posts } from "@/content/store";

export const dynamic = "force-dynamic";

export default async function Home() {
    const { env } = getCloudflareContext();
    const [entries, settings] = await Promise.all([
        posts(createDatabase(env.DB)).list({ status: "published", limit: 20 }),
        publicSiteSettings()
    ]);
    const permalink = settings.get("permalink.post");
    const datePattern = settings.get("format.date");
    const timePattern = settings.get("format.time");
    const entriesWithAddresses = entries.map(entry => {
        const publishedAt = entry.publishedAt ?? entry.createdAt;

        return {
            entry,
            address: postAddress(permalink, entry),
            published: `${formatMoment(publishedAt, datePattern)} ${formatMoment(publishedAt, timePattern)}`,
            publishedDateTime: publishedAt.toISOString()
        };
    });
    const siteTitle = settings.get("site.title");
    const siteDescription = settings.get("site.description").trim();

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

            {entries.length === 0 ?
                <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                    No Posts have been published yet.
                </div>
            :   <ul className="divide-y">
                    {entriesWithAddresses.map(({ entry, address, published, publishedDateTime }) => (
                        <li key={entry.id} className="py-7 first:pt-0">
                            <Link href={address} className="group block space-y-2">
                                <h2 className="text-xl font-semibold tracking-tight wrap-anywhere group-hover:text-primary">
                                    {entry.title}
                                </h2>
                                {entry.excerpt ?
                                    <p className="text-muted-foreground leading-7">{entry.excerpt}</p>
                                :   null}
                                <p className="text-muted-foreground text-sm">
                                    <time dateTime={publishedDateTime}>{published}</time>
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            }
        </main>
    );
}

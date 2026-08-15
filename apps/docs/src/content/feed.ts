import type { EntrySummaryOf } from "@jamcaaxian/core/content";
import type { post } from "./collections";
import { localizedPath, type DocsLocale } from "./locales";
import { postAddress } from "./public-paths";

export interface FeedDescription {
    origin: string;
    title: string;
    description: string;
    permalink: string;
    summaries: readonly EntrySummaryOf<typeof post>[];
    locale?: DocsLocale;
}

/** JSON Feed 1.1, built from the same Entry Summaries the public lists read. */
export function jsonFeed({ origin, title, description, permalink, summaries, locale }: FeedDescription) {
    const trimmed = description.trim();
    const homePath = locale === undefined ? "/" : localizedPath(locale);
    const feedPath = locale === undefined ? "/feed.json" : localizedPath(locale, "/feed.json");

    return {
        version: "https://jsonfeed.org/version/1.1",
        title,
        home_page_url: `${origin}${homePath}`,
        feed_url: `${origin}${feedPath}`,
        ...(trimmed ? { description: trimmed } : {}),
        items: summaries.map(summary => {
            const entryPath = postAddress(permalink, summary);
            const address = `${origin}${locale === undefined ? entryPath : localizedPath(locale, entryPath)}`;

            return {
                id: address,
                url: address,
                title: summary.title,
                // The specification requires one of content_text or content_html on every item.
                content_text: summary.excerpt ?? "",
                ...(summary.excerpt ? { summary: summary.excerpt } : {}),
                date_published: (summary.publishedAt ?? summary.createdAt).toISOString(),
                date_modified: summary.updatedAt.toISOString()
            };
        })
    };
}

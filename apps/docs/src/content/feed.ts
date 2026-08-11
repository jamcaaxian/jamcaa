import type { EntrySummaryOf } from "@jamcaa/core/content";
import type { post } from "./collections";
import { postAddress } from "./public-paths";

export interface FeedDescription {
    origin: string;
    title: string;
    description: string;
    permalink: string;
    summaries: readonly EntrySummaryOf<typeof post>[];
}

/** JSON Feed 1.1, built from the same Entry Summaries the public lists read. */
export function jsonFeed({ origin, title, description, permalink, summaries }: FeedDescription) {
    const trimmed = description.trim();

    return {
        version: "https://jsonfeed.org/version/1.1",
        title,
        home_page_url: `${origin}/`,
        feed_url: `${origin}/feed.json`,
        ...(trimmed ? { description: trimmed } : {}),
        items: summaries.map(summary => {
            const address = `${origin}${postAddress(permalink, summary)}`;

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

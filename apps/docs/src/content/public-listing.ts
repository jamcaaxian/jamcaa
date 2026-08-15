import type { EntrySummaryPage } from "@jamcaaxian/core/content";
import { formatMoment } from "@jamcaaxian/core/dates";
import type { post } from "@/content/collections";
import { localizedPath, type DocsLocale } from "@/content/locales";
import { postAddress } from "@/content/public-paths";
import type { PublicPostListingPage } from "@/content/public-listing-protocol";

export interface PublicPostListingDescription {
    path: string;
    cursor?: string;
    categorySlug?: string;
    tagSlug?: string;
    permalink: string;
    datePattern: string;
    timePattern: string;
    locale?: DocsLocale;
}

export function isInvalidEntrySummaryCursor(error: unknown): boolean {
    return error instanceof Error && error.message === "The Entry Summary cursor is invalid.";
}

function pageAddress(path: string, cursor: string | undefined): string {
    if (cursor === undefined) {
        return path;
    }

    return `${path}?${new URLSearchParams({ cursor }).toString()}`;
}

function dataAddress(description: PublicPostListingDescription, cursor: string): string {
    const query = new URLSearchParams();

    if (description.locale) query.set("locale", description.locale);
    if (description.categorySlug) query.set("category", description.categorySlug);
    if (description.tagSlug) query.set("tag", description.tagSlug);
    query.set("cursor", cursor);

    return `/api/public/posts?${query.toString()}`;
}

/** Site presentation for one Entry Summary keyset page. */
export function publicPostListing(
    page: EntrySummaryPage<typeof post>,
    description: PublicPostListingDescription
): PublicPostListingPage {
    return {
        pageAddress: pageAddress(description.path, description.cursor),
        items: page.summaries.map(entry => {
            const publishedAt = entry.publishedAt ?? entry.createdAt;
            const published = `${formatMoment(publishedAt, description.datePattern, description.locale)} ${formatMoment(
                publishedAt,
                description.timePattern,
                description.locale
            )}`;

            return {
                id: entry.id,
                address:
                    description.locale === undefined ?
                        postAddress(description.permalink, entry)
                    :   localizedPath(description.locale, postAddress(description.permalink, entry)),
                title: entry.title,
                excerpt: entry.excerpt,
                published: { dateTime: publishedAt.toISOString(), label: published }
            };
        }),
        next:
            page.nextCursor === undefined ?
                null
            :   {
                    pageAddress: pageAddress(description.path, page.nextCursor),
                    dataAddress: dataAddress(description, page.nextCursor)
                }
    };
}

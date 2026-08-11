import type { EntrySummaryOf } from "@jamcaa/core/content";
import { describe, expect, it } from "vitest";
import type { post } from "@/content/collections";
import { publicPostListing } from "@/content/public-listing";
import {
    appendPublicPostListingPage,
    beginPublicPostListingLoad,
    cancelPublicPostListingLoad,
    failPublicPostListingLoad,
    initialPublicPostListingState,
    publicPostListingPageFrom,
    type PublicPostListingPage,
    type PublicPostListItem
} from "@/content/public-listing-protocol";

type Summary = EntrySummaryOf<typeof post>;

function summary(overrides: Partial<Summary> = {}): Summary {
    return {
        id: "entry-1",
        slug: "hello",
        status: "published",
        authorId: "author-1",
        categoryId: "jamcaa-default-category",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-02T00:00:00.000Z"),
        publishedAt: new Date("2026-08-03T00:00:00.000Z"),
        title: "Hello",
        excerpt: "A short summary",
        ...overrides
    } as Summary;
}

function item(id: string): PublicPostListItem {
    return {
        id,
        address: `/${id}`,
        title: id,
        excerpt: null,
        published: { dateTime: "2026-08-03T00:00:00.000Z", label: "3 August 2026 00:00" }
    };
}

function page(items: PublicPostListItem[], next: PublicPostListingPage["next"] = null): PublicPostListingPage {
    return { pageAddress: "/?cursor=page", items, next };
}

describe("public Post listing presentation", () => {
    it("turns an Entry Summary page into serializable Site presentation", () => {
        const listing = publicPostListing(
            { summaries: [summary()], nextCursor: "next cursor" },
            {
                path: "/category/guides",
                cursor: "current cursor",
                categorySlug: "guides",
                permalink: "/{year}/{month}/{slug}",
                datePattern: "yyyy-MM-dd",
                timePattern: "HH:mm"
            }
        );

        expect(listing).toEqual({
            pageAddress: "/category/guides?cursor=current+cursor",
            items: [
                {
                    id: "entry-1",
                    address: "/2026/08/hello",
                    title: "Hello",
                    excerpt: "A short summary",
                    published: { dateTime: "2026-08-03T00:00:00.000Z", label: "2026-08-03 08:00" }
                }
            ],
            next: {
                pageAddress: "/category/guides?cursor=next+cursor",
                dataAddress: "/api/public/posts?category=guides&cursor=next+cursor"
            }
        });
        expect(listing.items[0]).not.toHaveProperty("body");
        expect(listing.items[0]).not.toHaveProperty("authorId");
    });

    it("validates the whole network protocol before returning it", () => {
        const valid = page([item("one")], { pageAddress: "/?cursor=two", dataAddress: "/api/public/posts?cursor=two" });

        expect(publicPostListingPageFrom(valid)).toEqual(valid);
        expect(publicPostListingPageFrom({ ...valid, items: [{ id: "one" }] })).toBeUndefined();
        expect(publicPostListingPageFrom({ ...valid, next: { pageAddress: "/?cursor=two" } })).toBeUndefined();
    });
});

describe("progressive public Post listing state", () => {
    it("deduplicates overlapping pages and completes on the last one", () => {
        const initial = page([item("one"), item("two")], {
            pageAddress: "/?cursor=two",
            dataAddress: "/api/public/posts?cursor=two"
        });
        const loading = beginPublicPostListingLoad(initialPublicPostListingState(initial));
        const loaded = appendPublicPostListingPage(loading, {
            pageAddress: "/?cursor=two",
            items: [item("two"), item("three")],
            next: null
        });

        expect(loading.phase).toBe("loading");
        expect(loaded.items.map(candidate => candidate.id)).toEqual(["one", "two", "three"]);
        expect(loaded.phase).toBe("complete");
        expect(loaded.next).toBeNull();
        expect(loaded.announcement).toContain("1 more Post loaded");
        expect(loaded.announcement).toContain("All Posts loaded");
    });

    it("keeps the next address through failure and focus-driven cancellation", () => {
        const initial = initialPublicPostListingState(
            page([item("one")], { pageAddress: "/?cursor=two", dataAddress: "/api/public/posts?cursor=two" })
        );
        const failed = failPublicPostListingLoad(beginPublicPostListingLoad(initial));
        const cancelled = cancelPublicPostListingLoad(beginPublicPostListingLoad(initial));

        expect(failed.phase).toBe("error");
        expect(failed.next).toEqual(initial.next);
        expect(cancelled).toMatchObject({ phase: "idle", next: initial.next, announcement: "" });
    });

    it("refuses a response for a different cursor before it changes list state", () => {
        const initial = initialPublicPostListingState(
            page([item("one")], { pageAddress: "/?cursor=two", dataAddress: "/api/public/posts?cursor=two" })
        );
        const unrelated = page([item("three")], null);

        expect(appendPublicPostListingPage(beginPublicPostListingLoad(initial), unrelated)).toMatchObject({
            items: initial.items,
            next: initial.next,
            phase: "error"
        });
    });
});

import type { EntrySummaryOf } from "@jamcaaxian/core/content";
import { describe, expect, it } from "vitest";
import type { post } from "@/content/collections";
import { jsonFeed } from "@/content/feed";

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

describe("the public feed", () => {
    it("describes itself with absolute addresses taken from the request", () => {
        const feed = jsonFeed({
            origin: "https://example.test",
            title: "jamcaa docs",
            description: "  A tagline  ",
            permalink: "/{year}/{month}/{slug}",
            summaries: [summary()]
        });

        expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
        expect(feed.home_page_url).toBe("https://example.test/");
        expect(feed.feed_url).toBe("https://example.test/feed.json");
        expect(feed.description).toBe("A tagline");
        expect(feed.items[0]).toMatchObject({
            id: "https://example.test/2026/08/hello",
            url: "https://example.test/2026/08/hello",
            title: "Hello",
            summary: "A short summary",
            content_text: "A short summary",
            date_published: "2026-08-03T00:00:00.000Z",
            date_modified: "2026-08-02T00:00:00.000Z"
        });
    });

    it("omits an absent tagline and still gives every item content", () => {
        const feed = jsonFeed({
            origin: "https://example.test",
            title: "jamcaa docs",
            description: "   ",
            permalink: "/{slug}",
            summaries: [summary({ excerpt: null })]
        });

        expect(feed).not.toHaveProperty("description");
        expect(feed.items[0]).not.toHaveProperty("summary");
        expect(feed.items[0]?.content_text).toBe("");
    });

    it("dates an Entry that was published without an explicit moment", () => {
        const feed = jsonFeed({
            origin: "https://example.test",
            title: "jamcaa docs",
            description: "",
            permalink: "/{slug}",
            summaries: [summary({ publishedAt: null })]
        });

        expect(feed.items[0]?.date_published).toBe("2026-08-01T00:00:00.000Z");
    });
});

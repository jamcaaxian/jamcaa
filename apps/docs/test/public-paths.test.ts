import type { BlockDocument, RichTextDocument } from "@jamcaaxian/core/content";
import { richTextFromPlainText } from "@jamcaaxian/core/content";
function blockBody(document: RichTextDocument): BlockDocument {
    return { version: 1, blocks: [{ id: "body", type: "builtin.richText", props: { document } }] };
}

import { describe, expect, it, vi } from "vitest";
import {
    checkPublicPermalink,
    freePublicPostSlug,
    isReservedPublicAddress,
    postAddress,
    resolvePublishedPost
} from "@/content/public-paths";

const entry = {
    slug: "hello",
    status: "published",
    title: "Hello",
    excerpt: null,
    body: blockBody(richTextFromPlainText("Hello")),
    publishedAt: new Date(Date.UTC(2026, 7, 9)),
    createdAt: new Date(Date.UTC(2020, 0, 1))
};

describe("public entry paths", () => {
    it("keeps the Site's own namespaces reserved", () => {
        expect(isReservedPublicAddress("/admin/example")).toBe(true);
        expect(isReservedPublicAddress("/category/example")).toBe(true);
        expect(isReservedPublicAddress("/media/example")).toBe(true);
        expect(isReservedPublicAddress("/preview/posts/example")).toBe(true);
        expect(isReservedPublicAddress("/search")).toBe(true);
        expect(isReservedPublicAddress("/tag/example")).toBe(true);
        expect(isReservedPublicAddress("/feed.json")).toBe(true);
        expect(isReservedPublicAddress("/favicon.svg")).toBe(true);
        expect(isReservedPublicAddress("/file.svg")).toBe(true);
        expect(isReservedPublicAddress("/writing/example")).toBe(false);
        expect(checkPublicPermalink("/admin/{slug}")).toMatch(/belongs to the Site/);
        expect(checkPublicPermalink("/feed.json/{slug}")).toMatch(/belongs to the Site/);
        expect(checkPublicPermalink("/preview/{slug}")).toMatch(/belongs to the Site/);
        expect(checkPublicPermalink("/writing/{slug}")).toBeUndefined();
    });

    it("builds the canonical Post address from the configured pattern", () => {
        expect(postAddress("/{year}/{month}/{slug}", entry)).toBe("/2026/08/hello");
    });

    it("allocates past both reserved and occupied public addresses", async () => {
        await expect(
            freePublicPostSlug({
                wanted: "admin",
                pattern: "/{slug}",
                publishedAt: entry.publishedAt,
                createdAt: entry.createdAt,
                isTaken: async slug => slug === "admin-2"
            })
        ).resolves.toBe("admin-3");
    });

    it("loads only a published Post at its exact canonical address", async () => {
        const bySlug = vi.fn(async (slug: string) => (slug === entry.slug ? entry : undefined));

        await expect(
            resolvePublishedPost({ pattern: "/{year}/{month}/{slug}", pathSegments: ["2026", "08", "hello"], bySlug })
        ).resolves.toBe(entry);
        await expect(
            resolvePublishedPost({ pattern: "/{year}/{month}/{slug}", pathSegments: ["2025", "08", "hello"], bySlug })
        ).resolves.toBeUndefined();
        await expect(
            resolvePublishedPost({ pattern: "/{slug}", pathSegments: ["admin"], bySlug })
        ).resolves.toBeUndefined();
    });

    it("does not expose a draft", async () => {
        const bySlug = vi.fn(async () => ({ ...entry, status: "draft" }));

        await expect(
            resolvePublishedPost({ pattern: "/{slug}", pathSegments: ["hello"], bySlug })
        ).resolves.toBeUndefined();
    });
});

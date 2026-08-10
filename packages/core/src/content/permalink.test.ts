import { describe, expect, it } from "vitest";
import { buildPermalink, checkPermalink, matchPermalink, permalinkSettings, PERMALINK_PATTERNS } from "./permalink";
import { defineCollection } from "./collection";
import { text } from "./fields";

describe("checkPermalink", () => {
    it("accepts every pattern offered as a preset", () => {
        for (const pattern of PERMALINK_PATTERNS) {
            expect(checkPermalink(pattern)).toBeUndefined();
        }
    });

    it("insists on a leading slash", () => {
        expect(checkPermalink("{slug}")).toMatch(/starts with a slash/);
    });

    it("refuses an address that would be the same for every entry", () => {
        expect(checkPermalink("/blog")).toMatch(/must include \{slug\}/);
        expect(checkPermalink("/{year}/{month}")).toMatch(/must include \{slug\}/);
    });

    it("names the tokens there are when given one there is not", () => {
        const problem = checkPermalink("/{category}/{slug}") ?? "";

        expect(problem).toMatch(/nothing called \{category\}/);
        expect(problem).toMatch(/\{slug\}/);
    });

    it("keeps tokens as complete path segments", () => {
        expect(checkPermalink("/news-{year}/{slug}")).toMatch(/complete path segment/);
        expect(checkPermalink("/{year}//{slug}")).toMatch(/non-empty path segments/);
        expect(checkPermalink("/{slug}?preview=true")).toMatch(/query string or fragment/);
    });
});

describe("buildPermalink", () => {
    const entry = {
        slug: "hello",
        collection: "post",
        publishedAt: new Date(Date.UTC(2026, 7, 9)),
        createdAt: new Date(Date.UTC(2020, 0, 1))
    };

    it("puts the entry into the pattern", () => {
        expect(buildPermalink("/{year}/{month}/{day}/{slug}", entry)).toBe("/2026/08/09/hello");
        expect(buildPermalink("/{collection}/{slug}", entry)).toBe("/post/hello");
    });

    it("dates the address by when it went out", () => {
        expect(buildPermalink("/{year}/{slug}", entry)).toBe("/2026/hello");
    });

    it("falls back to when it was written while it is still a draft", () => {
        expect(buildPermalink("/{year}/{slug}", { ...entry, publishedAt: null })).toBe("/2020/hello");
    });

    it("keeps a slug written in another script", () => {
        expect(buildPermalink("/{slug}", { ...entry, slug: "你好-世界" })).toBe("/你好-世界");
    });
});

describe("matchPermalink", () => {
    const entry = {
        slug: "hello",
        collection: "post",
        publishedAt: new Date(Date.UTC(2026, 7, 9)),
        createdAt: new Date(Date.UTC(2020, 0, 1))
    };

    it("extracts a slug from literal and token segments", () => {
        expect(matchPermalink("/writing/{slug}", "/writing/hello")).toEqual({ slug: "hello" });
        expect(matchPermalink("/{collection}/{slug}", "/post/hello")).toEqual({ slug: "hello" });
    });

    it("refuses a different shape or literal", () => {
        expect(matchPermalink("/writing/{slug}", "/notes/hello")).toBeUndefined();
        expect(matchPermalink("/{year}/{slug}", "/2026/08/hello")).toBeUndefined();
    });

    it("verifies date and collection tokens against the loaded entry", () => {
        expect(matchPermalink("/{year}/{month}/{day}/{slug}", "/2026/08/09/hello", entry)).toEqual({ slug: "hello" });
        expect(matchPermalink("/{year}/{month}/{day}/{slug}", "/2025/08/09/hello", entry)).toBeUndefined();
        expect(matchPermalink("/{collection}/{slug}", "/guide/hello", entry)).toBeUndefined();
    });
});

describe("permalinkSettings", () => {
    it("gives each collection its own address to configure", () => {
        const post = defineCollection({
            name: "post",
            label: "Post",
            plural: "Posts",
            fields: { title: text({ required: true }) }
        });
        const guide = defineCollection({
            name: "guide",
            label: "Guide",
            plural: "Guides",
            fields: { title: text({ required: true }) }
        });

        const catalogue = permalinkSettings([post, guide]);

        expect(Object.keys(catalogue)).toEqual(["permalink.post", "permalink.guide"]);
        expect(catalogue["permalink.guide"]?.label).toBe("Guides address");
    });

    it("defaults to an address it would accept", () => {
        const post = defineCollection({
            name: "post",
            label: "Post",
            plural: "Posts",
            fields: { title: text({ required: true }) }
        });

        const declaration = permalinkSettings([post])["permalink.post"];

        expect(declaration && checkPermalink(String(declaration.default))).toBeUndefined();
    });
});

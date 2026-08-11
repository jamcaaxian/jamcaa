import { describe, expect, it } from "vitest";
import { defineCollection } from "../content/collection";
import { number, richText, text } from "../content/fields";
import { richTextFromPlainText } from "../content/rich-text";
import { searchMigrationSql, searchTableName } from "./migration";
import { searchProjection, searchProjectionSql } from "./projection";
import { decodeSearchCursor, encodeSearchCursor, literalSearchQuery, searchLimit } from "./query";

const post = defineCollection({
    name: "post",
    label: "Post",
    plural: "Posts",
    fields: { title: text({ required: true }), excerpt: text(), body: richText({ required: true }) },
    search: { fields: ["title", "excerpt", "body"] }
});

describe("search query rules", () => {
    it("turns reader input into ANDed literal phrases", () => {
        expect(literalSearchQuery('  edge runtime "safe" full-text  ')).toBe('"edge" "runtime" "safe" "full" "text"');
        expect(literalSearchQuery("---")).toBeUndefined();
    });

    it("keeps limits within the public contract", () => {
        expect(searchLimit(undefined)).toBe(20);
        expect(searchLimit(50)).toBe(50);
        expect(() => searchLimit(51)).toThrow(/1 to 50/i);
        expect(() => searchLimit(1.5)).toThrow(/integer/i);
    });

    it("round-trips opaque rank cursors and rejects forged ones", () => {
        const cursor = encodeSearchCursor({ rank: -0.125, rowId: 42 });

        expect(decodeSearchCursor(cursor)).toEqual({ rank: -0.125, rowId: 42 });
        expect(() => decodeSearchCursor("not+a+cursor")).toThrow(/cursor is invalid/i);
    });
});

describe("search projection", () => {
    it("projects text and Rich Text Media alternatives in declaration order", () => {
        expect(
            searchProjection(post, {
                title: "Search",
                excerpt: null,
                body: {
                    type: "doc",
                    content: [
                        ...richTextFromPlainText("A body").content,
                        { type: "mediaImage", attrs: { mediaId: crypto.randomUUID(), alt: "Architecture diagram" } }
                    ]
                }
            })
        ).toEqual(["Search", "", "A body\nArchitecture diagram"]);
    });

    it("keeps inline text together and separates block-level tokenizer inputs", () => {
        const sql = searchProjectionSql(post, "new")[2];

        expect(sql).toContain("group_concat(piece, '')");
        expect(sql).toContain("group_concat(group_text, char(10))");
        expect(sql).toContain("ELSE nodes.path");
    });

    it("refuses a Collection without a search declaration", () => {
        const privateCollection = defineCollection({
            name: "private_note",
            label: "Private Note",
            plural: "Private Notes",
            fields: { title: text(), score: number() }
        });

        expect(() => searchProjection(privateCollection, { title: "Hidden" })).toThrow(/no search declaration/i);
    });
});

describe("search migration generation", () => {
    it("derives the FTS table, published-only triggers, JSON projection, and backfill", () => {
        const sql = searchMigrationSql(post);

        expect(searchTableName(post)).toBe("_jamcaa_post_fts");
        expect(sql).toContain("USING fts5");
        expect(sql).toContain("unicode61 remove_diacritics 2");
        expect(sql).toContain("WHEN new.status = 'published'");
        expect(sql).toContain('DELETE FROM "_jamcaa_post_fts"');
        expect(sql).toContain('FROM json_tree(entry."body")');
        expect(sql).toContain('FROM json_tree(new."body")');
        expect(sql).toContain("WHERE nodes.type = 'object'");
        expect(sql).toContain("group_concat(group_text, char(10))");
        expect(sql).toContain("'mediaImage'");
        expect(sql).toContain("WHERE entry.status = 'published'");
    });
});

import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection, type EntryOf } from "./collection";
import { choice, markdown, moment, number, reference, richText, text, toggle } from "./fields";
import { defineContentModel } from "./model";
import type { RichTextDocument } from "./rich-text";
import { buildTable } from "./table";
import { systemFieldNames } from "./system-fields";
import type { EntrySummaryOf } from "./summaries";
import { decodeEntrySummaryCursor, encodeEntrySummaryCursor } from "./summaries";

const post = defineCollection({
    name: "post",
    label: "Post",
    plural: "Posts",
    fields: {
        title: text({ required: true }),
        excerpt: text(),
        body: richText({ required: true }),
        readingTime: number({ whole: true }),
        featured: toggle(),
        embargoedUntil: moment(),
        tone: choice({ of: ["neutral", "urgent"], required: true })
    }
});

describe("defineCollection", () => {
    it("names an entry with the first text field when not told otherwise", () => {
        expect(post.titleField).toBe("title");
    });

    it("refuses a name that could not be a table", () => {
        expect(() =>
            defineCollection({ name: "Blog Post", label: "x", plural: "x", fields: { title: text() } })
        ).toThrow(/must be lower case/);
    });

    it("refuses to shadow one of the platform's own tables", () => {
        expect(() => defineCollection({ name: "session", label: "x", plural: "x", fields: { title: text() } })).toThrow(
            /belongs to one of the platform/
        );
    });

    it("refuses a field that every entry already has", () => {
        expect(() =>
            defineCollection({ name: "note", label: "x", plural: "x", fields: { title: text(), slug: text() } })
        ).toThrow(/collides with a field every entry already has/);
    });

    it("refuses a collection with nothing in it", () => {
        expect(() => defineCollection({ name: "empty", label: "x", plural: "x", fields: {} })).toThrow(
            /at least one field/
        );
    });

    it("refuses a titleField that is not a field", () => {
        expect(() =>
            defineCollection({
                name: "note",
                label: "x",
                plural: "x",
                fields: { body: richText() },
                titleField: "heading" as never
            })
        ).toThrow(/is not one of its fields/);
    });

    it("insists on something to name an entry by", () => {
        expect(() => defineCollection({ name: "note", label: "x", plural: "x", fields: { body: richText() } })).toThrow(
            /no field can name an entry/
        );
    });

    it("says how many columns are left when the table would be too wide", () => {
        const fields: Record<string, ReturnType<typeof text>> = {};

        for (let index = 0; index < 101 - systemFieldNames.length; index += 1) {
            fields[`field${index}`] = text();
        }

        expect(() => defineCollection({ name: "wide", label: "x", plural: "x", fields })).toThrow(/D1 allows 100/);
    });

    it("allows a table that exactly fills the limit", () => {
        const fields: Record<string, ReturnType<typeof text>> = {};

        for (let index = 0; index < 100 - systemFieldNames.length; index += 1) {
            fields[`field${index}`] = text();
        }

        expect(() => defineCollection({ name: "full", label: "x", plural: "x", fields })).not.toThrow();
    });

    it("declares an ordered public search projection", () => {
        const searchable = defineCollection({
            name: "guide",
            label: "Guide",
            plural: "Guides",
            fields: { title: text(), summary: markdown(), body: richText(), score: number() },
            search: { fields: ["title", "summary", "body"] }
        });

        expect(searchable.search?.fields).toEqual(["title", "summary", "body"]);
    });

    it("refuses an invalid public search projection", () => {
        expect(() =>
            defineCollection({
                name: "scorecard",
                label: "Scorecard",
                plural: "Scorecards",
                fields: { title: text(), score: number() },
                search: { fields: ["score" as never] }
            })
        ).toThrow(/no searchable text representation/i);

        expect(() =>
            defineCollection({
                name: "duplicate_search",
                label: "Duplicate Search",
                plural: "Duplicate Searches",
                fields: { title: text() },
                search: { fields: ["title", "title"] }
            })
        ).toThrow(/declared more than once/i);
    });

    it("declares a lightweight public Entry Summary projection", () => {
        const summarized = defineCollection({
            name: "release",
            label: "Release",
            plural: "Releases",
            fields: { title: text(), excerpt: text(), body: richText(), score: number() },
            summary: { fields: ["title", "excerpt", "score"] }
        });

        expect(summarized.summary?.fields).toEqual(["title", "excerpt", "score"]);
    });

    it("refuses a long-form or incomplete Entry Summary projection", () => {
        expect(() =>
            defineCollection({
                name: "long_summary",
                label: "Long Summary",
                plural: "Long Summaries",
                fields: { title: text(), body: richText() },
                summary: { fields: ["title", "body" as never] }
            })
        ).toThrow(/long-form content/i);

        expect(() =>
            defineCollection({
                name: "missing_title_summary",
                label: "Missing Title Summary",
                plural: "Missing Title Summaries",
                fields: { title: text(), excerpt: text() },
                summary: { fields: ["excerpt"] }
            })
        ).toThrow(/must include its titleField/i);

        expect(() =>
            defineCollection({
                name: "duplicate_summary",
                label: "Duplicate Summary",
                plural: "Duplicate Summaries",
                fields: { title: text() },
                summary: { fields: ["title", "title"] }
            })
        ).toThrow(/declared more than once/i);
    });
});

describe("buildTable", () => {
    const table = getTableConfig(buildTable(post));
    const columns = new Map(table.columns.map(column => [column.name, column]));

    it("gives every entry the fields the platform manages", () => {
        for (const name of ["id", "slug", "status", "author_id", "category_id", "created_at", "updated_at"]) {
            expect(columns.has(name)).toBe(true);
        }
    });

    it("writes declared fields as snake case columns", () => {
        expect(columns.has("reading_time")).toBe(true);
        expect(columns.has("embargoed_until")).toBe(true);
    });

    it("carries required through to NOT NULL", () => {
        expect(columns.get("title")?.notNull).toBe(true);
        expect(columns.get("excerpt")?.notNull).toBe(false);
    });

    it("stores whole numbers as integers and the rest as reals", () => {
        expect(columns.get("reading_time")?.getSQLType()).toBe("integer");
        expect(
            getTableConfig(buildTable(withLoose))
                .columns.find(c => c.name === "score")
                ?.getSQLType()
        ).toBe("real");
    });

    it("keeps one slug to one entry", () => {
        expect(table.indexes.some(index => index.config.unique)).toBe(true);
    });
});

const withLoose = defineCollection({
    name: "rating",
    label: "Rating",
    plural: "Ratings",
    fields: { title: text({ required: true }), score: number() }
});

describe("defineContentModel", () => {
    it("refuses two collections with one name", () => {
        expect(() => defineContentModel([post, post])).toThrow(/both named "post"/);
    });

    it("refuses a reference to a collection nobody declared", () => {
        const orphan = defineCollection({
            name: "review",
            label: "Review",
            plural: "Reviews",
            fields: { title: text({ required: true }), subject: reference({ to: "film" }) }
        });

        expect(() => defineContentModel([orphan])).toThrow(/no collection declares/);
    });

    it("accepts a reference once its target is declared", () => {
        const film = defineCollection({
            name: "film",
            label: "Film",
            plural: "Films",
            fields: { title: text({ required: true }) }
        });
        const review = defineCollection({
            name: "review",
            label: "Review",
            plural: "Reviews",
            fields: { title: text({ required: true }), subject: reference({ to: "film" }) }
        });

        const model = defineContentModel([film, review]);

        expect(model.collection("review")?.label).toBe("Review");
        expect(model.table("film")).toBeDefined();
        expect(model.tagTable("film")).toBeDefined();
    });

    it("derives a Tag relation whose Entry side cascades", () => {
        const model = defineContentModel([post]);
        const relationTable = model.tagTable("post");

        expect(relationTable).toBeDefined();

        const relation = getTableConfig(relationTable!);

        expect(relation.name).toBe("_jamcaa_post_tag");
        expect(relation.foreignKeys).toHaveLength(2);
        expect(relation.foreignKeys.some(key => key.onDelete === "cascade")).toBe(true);
    });
});

describe("the type an entry takes", () => {
    type Post = EntryOf<typeof post>;

    it("derives from the declaration rather than being written twice", () => {
        expectTypeOf<Post["title"]>().toEqualTypeOf<string>();
        expectTypeOf<Post["body"]>().toEqualTypeOf<RichTextDocument>();
    });

    it("lets an optional field be absent", () => {
        expectTypeOf<Post["excerpt"]>().toEqualTypeOf<string | null>();
        expectTypeOf<Post["readingTime"]>().toEqualTypeOf<number | null>();
        expectTypeOf<Post["featured"]>().toEqualTypeOf<boolean | null>();
    });

    it("narrows a choice to what was offered", () => {
        expectTypeOf<Post["tone"]>().toEqualTypeOf<"neutral" | "urgent">();
    });

    it("includes what the platform manages", () => {
        expectTypeOf<Post["id"]>().toEqualTypeOf<string>();
        expectTypeOf<Post["categoryId"]>().toEqualTypeOf<string>();
        expectTypeOf<Post["publishedAt"]>().toEqualTypeOf<Date | null>();
    });

    it("derives a lightweight Entry Summary type from its declaration", () => {
        const summarizedPost = defineCollection({
            name: "summarized_post",
            label: "Post",
            plural: "Posts",
            fields: { title: text({ required: true }), excerpt: text(), body: richText({ required: true }) },
            summary: { fields: ["title", "excerpt"] }
        });
        type Summary = EntrySummaryOf<typeof summarizedPost>;

        expect(summarizedPost.summary?.fields).toEqual(["title", "excerpt"]);
        expectTypeOf<Summary["title"]>().toEqualTypeOf<string>();
        expectTypeOf<Summary["excerpt"]>().toEqualTypeOf<string | null>();
        expectTypeOf<Summary["status"]>().toEqualTypeOf<"published">();
        expectTypeOf<Summary>().not.toHaveProperty("body");
    });
});

describe("the Entry Summary cursor", () => {
    it("round-trips a position and refuses a forged one", () => {
        const cursor = encodeEntrySummaryCursor({ publishedAt: 1_760_000_000_000, id: "entry-1" });

        expect(decodeEntrySummaryCursor(cursor)).toEqual({ publishedAt: 1_760_000_000_000, id: "entry-1" });
        expect(decodeEntrySummaryCursor(undefined)).toBeUndefined();
        expect(() => decodeEntrySummaryCursor("not+a+cursor")).toThrow(/cursor is invalid/i);
        expect(() => decodeEntrySummaryCursor(btoa('{"v":2,"p":1,"i":"a"}'))).toThrow(/cursor is invalid/i);
    });
});

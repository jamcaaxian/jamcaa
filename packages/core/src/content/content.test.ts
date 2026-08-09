import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection, type EntryOf } from "./collection";
import { choice, markdown, moment, number, reference, text, toggle } from "./fields";
import { defineContentModel } from "./model";
import { buildTable } from "./table";
import { systemFieldNames } from "./system-fields";

const post = defineCollection({
    name: "post",
    label: "Post",
    plural: "Posts",
    fields: {
        title: text({ required: true }),
        excerpt: text(),
        body: markdown({ required: true }),
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
                fields: { body: markdown() },
                titleField: "heading" as never
            })
        ).toThrow(/is not one of its fields/);
    });

    it("insists on something to name an entry by", () => {
        expect(() => defineCollection({ name: "note", label: "x", plural: "x", fields: { body: markdown() } })).toThrow(
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
});

describe("buildTable", () => {
    const table = getTableConfig(buildTable(post));
    const columns = new Map(table.columns.map(column => [column.name, column]));

    it("gives every entry the fields the platform manages", () => {
        for (const name of ["id", "slug", "status", "author_id", "created_at", "updated_at"]) {
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
    });
});

describe("the type an entry takes", () => {
    type Post = EntryOf<typeof post>;

    it("derives from the declaration rather than being written twice", () => {
        expectTypeOf<Post["title"]>().toEqualTypeOf<string>();
        expectTypeOf<Post["body"]>().toEqualTypeOf<string>();
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
        expectTypeOf<Post["publishedAt"]>().toEqualTypeOf<Date | null>();
    });
});

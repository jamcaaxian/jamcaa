import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { searchMigrationSql, searchProjection, searchProjectionSql } from "../search";
import { defineCollection } from "./collection";
import { editingFields, parseCollectionSubmission } from "./editing";
import { declaredFieldStorage } from "./entries";
import { fieldSnapshotValue, fieldValueFromSnapshot } from "./field-values";
import { entryRevisionSnapshot } from "./revisions";
import { choice, markdown, moment, number, reference, richText, text, toggle } from "./fields";
import { richTextFromPlainText } from "./rich-text";
import { systemFieldNames } from "./system-fields";
import { buildTable } from "./table";

const fields = defineCollection({
    name: "field_contract",
    label: "Field Contract",
    plural: "Field Contracts",
    fields: {
        title: text({ required: true }),
        longNote: markdown({ label: "Long note" }),
        body: richText({ required: true }),
        score: number(),
        wholeCount: number({ whole: true, required: true }),
        featured: toggle(),
        happenedAt: moment(),
        state: choice({ of: ["draft", "published"] as const, required: true }),
        parent: reference({ to: "field_contract" })
    }
});

const values = {
    title: "A title",
    longNote: "  Markdown stays exact.  ",
    body: richTextFromPlainText("A body"),
    score: 4.5,
    wholeCount: 3,
    featured: true,
    happenedAt: new Date("2026-08-12T09:00:00.000Z"),
    state: "published" as const,
    parent: "parent-id"
};

const happenedAtMilliseconds = 1_786_525_200_000;

function declaredColumnsOf(collection: Parameters<typeof buildTable>[0]) {
    const declaredNames = new Set(
        systemFieldNames.map(name => name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))
    );

    return getTableConfig(buildTable(collection))
        .columns.filter(column => !declaredNames.has(column.name))
        .map(column => ({ name: column.name, type: column.getSQLType(), notNull: column.notNull }));
}

/** The same eight built-ins with requiredness flipped, so every kind is locked in both states. */
const flipped = defineCollection({
    name: "field_contract_flipped",
    label: "Field Contract Flipped",
    plural: "Field Contracts Flipped",
    fields: {
        title: text({ description: "Names the Entry." }),
        longNote: markdown({ required: true }),
        body: richText(),
        score: number({ required: true }),
        wholeCount: number({ whole: true }),
        featured: toggle({ required: true }),
        happenedAt: moment({ required: true }),
        state: choice({ of: ["draft", "published"] as const }),
        parent: reference({ to: "field_contract", required: true })
    }
});

async function sha256(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

describe("built-in Field contracts", () => {
    it("keeps the physical column layout, affinity, declaration order, and nullability stable", () => {
        expect(declaredColumnsOf(fields)).toEqual([
            { name: "title", type: "text", notNull: true },
            { name: "long_note", type: "text", notNull: false },
            { name: "body", type: "text", notNull: true },
            { name: "score", type: "real", notNull: false },
            { name: "whole_count", type: "integer", notNull: true },
            { name: "featured", type: "integer", notNull: false },
            { name: "happened_at", type: "integer", notNull: false },
            { name: "state", type: "text", notNull: true },
            { name: "parent", type: "text", notNull: false }
        ]);
    });

    it("keeps affinity stable when requiredness flips", () => {
        expect(declaredColumnsOf(flipped)).toEqual([
            { name: "title", type: "text", notNull: false },
            { name: "long_note", type: "text", notNull: true },
            { name: "body", type: "text", notNull: false },
            { name: "score", type: "real", notNull: true },
            { name: "whole_count", type: "integer", notNull: false },
            { name: "featured", type: "integer", notNull: true },
            { name: "happened_at", type: "integer", notNull: true },
            { name: "state", type: "text", notNull: false },
            { name: "parent", type: "text", notNull: true }
        ]);
    });

    it("keeps declared SQL fragments and database bindings stable", () => {
        expect(declaredFieldStorage(fields, values)).toEqual({
            columns:
                '"title", "long_note", "body", "score", "whole_count", "featured", "happened_at", "state", "parent"',
            placeholders: "?, ?, ?, ?, ?, ?, ?, ?, ?",
            assignments:
                '"title" = ?, "long_note" = ?, "body" = ?, "score" = ?, "whole_count" = ?, "featured" = ?, "happened_at" = ?, "state" = ?, "parent" = ?',
            bindings: [
                "A title",
                "  Markdown stays exact.  ",
                JSON.stringify(values.body),
                4.5,
                3,
                1,
                happenedAtMilliseconds,
                "published",
                "parent-id"
            ]
        });
    });

    it("keeps optional Fields as single NULL bindings", () => {
        expect(
            declaredFieldStorage(fields, {
                ...values,
                longNote: null,
                score: null,
                featured: null,
                happenedAt: null,
                parent: null
            }).bindings
        ).toEqual(["A title", null, JSON.stringify(values.body), null, 3, null, null, "published", null]);
    });

    it("keeps Revision format v1 Field payloads and decoders stable", () => {
        const encoded = Object.fromEntries(
            Object.entries(fields.fields).map(([name, field]) => [
                name,
                fieldSnapshotValue(field, values[name as keyof typeof values])
            ])
        );

        expect(encoded).toEqual({
            title: "A title",
            longNote: "  Markdown stays exact.  ",
            body: values.body,
            score: 4.5,
            wholeCount: 3,
            featured: true,
            happenedAt: happenedAtMilliseconds,
            state: "published",
            parent: "parent-id"
        });
        expect(
            Object.fromEntries(
                Object.entries(fields.fields).map(([name, field]) => [
                    name,
                    fieldValueFromSnapshot(field, encoded[name])
                ])
            )
        ).toEqual(values);
    });

    it("keeps serializable Editing Control descriptors stable", () => {
        const descriptors = editingFields(fields);

        expect(descriptors).toEqual([
            { name: "title", label: "Title", required: true, kind: "text" },
            { name: "longNote", label: "Long note", required: false, kind: "markdown" },
            { name: "body", label: "Body", required: true, kind: "richText" },
            { name: "score", label: "Score", required: false, kind: "number", whole: false },
            { name: "wholeCount", label: "Whole Count", required: true, kind: "number", whole: true },
            { name: "featured", label: "Featured", required: false, kind: "toggle" },
            { name: "happenedAt", label: "Happened At", required: false, kind: "moment" },
            { name: "state", label: "State", required: true, kind: "choice", choices: ["draft", "published"] },
            { name: "parent", label: "Parent", required: false, kind: "reference", collection: "field_contract" }
        ]);
        expect(structuredClone(descriptors)).toEqual(descriptors);
    });

    it("carries a declared description through the serializable descriptor", () => {
        expect(editingFields(flipped)).toContainEqual({
            name: "title",
            label: "Title",
            description: "Names the Entry.",
            required: false,
            kind: "text"
        });
    });

    it("keeps the Revision v1 snapshot envelope stable", () => {
        const entry = {
            id: "entry-1",
            locale: "en-US",
            translationId: "entry-1",
            slug: "entry-one",
            status: "draft" as const,
            authorId: "author-1",
            categoryId: "category-1",
            createdAt: new Date("2026-08-12T08:00:00.000Z"),
            updatedAt: new Date("2026-08-12T08:01:00.000Z"),
            publishedAt: null,
            ...values
        };

        expect(entryRevisionSnapshot(fields, entry, ["tag-2", "tag-1", "tag-2"])).toEqual({
            slug: "entry-one",
            status: "draft",
            publishedAt: null,
            categoryId: "category-1",
            fields: values,
            tagIds: ["tag-1", "tag-2"]
        });
    });

    it("keeps built-in submission representations stable", () => {
        const formData = new FormData();
        formData.set("title", "  A title  ");
        formData.set("longNote", "  Markdown stays exact.  ");
        formData.set("body", JSON.stringify(values.body));
        formData.set("score", "4.5");
        formData.set("wholeCount", "3");
        formData.set("featured", "true");
        formData.set("happenedAt", "2026-08-12T09:00:00.000Z");
        formData.set("state", "published");
        formData.set("parent", " parent-id ");

        expect(parseCollectionSubmission(fields, formData)).toEqual({ success: true, values });
    });
});

describe("built-in Search contracts", () => {
    const post = defineCollection({
        name: "post",
        label: "Post",
        plural: "Posts",
        fields: { title: text({ required: true }), excerpt: text(), body: richText({ required: true }) },
        search: { fields: ["title", "excerpt", "body"] }
    });

    it("keeps runtime and SQLite projections aligned in declaration order", () => {
        const body = {
            type: "doc" as const,
            content: [
                ...richTextFromPlainText("A body").content,
                { type: "mediaImage" as const, attrs: { mediaId: crypto.randomUUID(), alt: "Architecture diagram" } }
            ]
        };

        expect(searchProjection(post, { title: "Search", excerpt: null, body })).toEqual([
            "Search",
            "",
            "A body\nArchitecture diagram"
        ]);
        expect(searchProjectionSql(post, "new")).toEqual([
            "coalesce(new.\"title\", '')",
            "coalesce(new.\"excerpt\", '')",
            expect.stringContaining('FROM json_tree(new."body") AS nodes')
        ]);
    });

    it("keeps the complete Post FTS migration artifact stable", async () => {
        expect(await sha256(searchMigrationSql(post))).toBe(
            "198e9c532a7d808be018f8309a92435b28afec9e66f9fbb16112b2ae3a36b188"
        );
    });
});

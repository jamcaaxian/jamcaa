import { describe, expect, it } from "vitest";
import {
    choice,
    defineCollection,
    editingFields,
    markdown,
    moment,
    number,
    parseCollectionSubmission,
    reference,
    richText,
    richTextFromPlainText,
    text,
    toggle
} from "./index";

const collection = defineCollection({
    name: "example",
    label: "Example",
    plural: "Examples",
    fields: {
        title: text({ required: true }),
        longNote: markdown({ label: "Long note" }),
        body: richText({ required: true }),
        rating: number(),
        count: number({ whole: true }),
        featured: toggle({ required: true }),
        promoted: toggle(),
        happenedAt: moment(),
        state: choice({ of: ["draft", "published"] as const, required: true }),
        parent: reference({ to: "example" })
    }
});

describe("Collection Editing Fields", () => {
    it("projects serializable Editing Control requirements in declaration order", () => {
        const fields = editingFields(collection);

        expect(fields.map(field => field.name)).toEqual([
            "title",
            "longNote",
            "body",
            "rating",
            "count",
            "featured",
            "promoted",
            "happenedAt",
            "state",
            "parent"
        ]);
        expect(fields).toContainEqual(
            expect.objectContaining({ name: "longNote", label: "Long note", kind: "markdown" })
        );
        expect(fields).toContainEqual(expect.objectContaining({ name: "count", whole: true }));
        expect(fields).toContainEqual(expect.objectContaining({ name: "state", choices: ["draft", "published"] }));
        expect(fields).toContainEqual(expect.objectContaining({ name: "parent", collection: "example" }));
        expect(structuredClone(fields)).toEqual(fields);
    });

    it("parses every built-in Field kind into declared values", () => {
        const formData = new FormData();
        formData.set("title", "  A title  ");
        formData.set("longNote", "Line one\nLine two");
        formData.set("body", JSON.stringify(richTextFromPlainText("A body")));
        formData.set("rating", "4.5");
        formData.set("count", "3");
        formData.set("featured", "false");
        formData.set("promoted", "");
        formData.set("happenedAt", "2026-08-12T08:00:00.000Z");
        formData.set("state", "published");
        formData.set("parent", " parent-id ");

        expect(parseCollectionSubmission(collection, formData)).toEqual({
            success: true,
            values: {
                title: "A title",
                longNote: "Line one\nLine two",
                body: richTextFromPlainText("A body"),
                rating: 4.5,
                count: 3,
                featured: false,
                promoted: null,
                happenedAt: new Date("2026-08-12T08:00:00.000Z"),
                state: "published",
                parent: "parent-id"
            }
        });
    });

    it("returns stable required and invalid issues without reading unrelated fields", () => {
        const formData = new FormData();
        formData.set("title", "   ");
        formData.set("longNote", "");
        formData.set("body", JSON.stringify(richTextFromPlainText("")));
        formData.set("rating", "   ");
        formData.set("count", "2.5");
        formData.set("featured", "maybe");
        formData.set("promoted", "");
        formData.set("happenedAt", "not-a-date");
        formData.set("state", "deleted");
        formData.set("parent", "");
        formData.set("status", "published");

        expect(parseCollectionSubmission(collection, formData)).toEqual({
            success: false,
            issues: [
                { field: "title", code: "required" },
                { field: "body", code: "required" },
                { field: "count", code: "invalid" },
                { field: "featured", code: "invalid" },
                { field: "happenedAt", code: "invalid" },
                { field: "state", code: "invalid" }
            ]
        });
    });

    it("rejects repeated scalar values and File submissions", () => {
        const formData = new FormData();
        formData.append("title", "First");
        formData.append("title", "Second");
        formData.set("longNote", "");
        formData.set("body", JSON.stringify(richTextFromPlainText("Body")));
        formData.set("rating", "");
        formData.set("count", "");
        formData.set("featured", "true");
        formData.set("promoted", "");
        formData.set("happenedAt", "");
        formData.set("state", "draft");
        formData.set("parent", new File(["x"], "x.txt"));

        expect(parseCollectionSubmission(collection, formData)).toMatchObject({
            success: false,
            issues: expect.arrayContaining([
                { field: "title", code: "invalid" },
                { field: "parent", code: "invalid" }
            ])
        });
    });

    it("uses each Field's parse contract as the final validation seam", () => {
        const custom = defineCollection({
            name: "custom",
            label: "Custom",
            plural: "Custom",
            fields: {
                title: {
                    ...text({ required: true }),
                    parse: (value: unknown) => {
                        if (value !== "accepted") {
                            throw new Error("refused");
                        }

                        return value;
                    }
                }
            }
        });
        const formData = new FormData();
        formData.set("title", "refused");

        expect(parseCollectionSubmission(custom, formData)).toEqual({
            success: false,
            issues: [{ field: "title", code: "invalid" }]
        });
    });

    it("safely refuses a Field without a parse contract", () => {
        const unsafe = defineCollection({
            name: "unsafe",
            label: "Unsafe",
            plural: "Unsafe",
            fields: { title: { ...text({ required: true }), parse: undefined } }
        });
        const formData = new FormData();
        formData.set("title", "A title");

        expect(parseCollectionSubmission(unsafe, formData)).toEqual({
            success: false,
            issues: [{ field: "title", code: "invalid" }]
        });
    });

    it("treats whitespace-only required Markdown as missing without trimming valid Markdown", () => {
        const notes = defineCollection({
            name: "notes",
            label: "Note",
            plural: "Notes",
            fields: { title: text({ required: true }), content: markdown({ required: true }) }
        });
        const missing = new FormData();
        missing.set("title", "A note");
        missing.set("content", "   \n");

        expect(parseCollectionSubmission(notes, missing)).toEqual({
            success: false,
            issues: [{ field: "content", code: "required" }]
        });

        missing.set("content", "  # Kept exactly  \n");
        expect(parseCollectionSubmission(notes, missing)).toMatchObject({
            success: true,
            values: { content: "  # Kept exactly  \n" }
        });
    });
});

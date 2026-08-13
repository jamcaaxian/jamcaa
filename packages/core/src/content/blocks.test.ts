import { describe, expect, it } from "vitest";
import { blockPlainText, type BlockDocument } from "./blocks";
import { blocks } from "./fields";
import { capsuleOf } from "./field-capsule";
import { richTextPlainText } from "./rich-text";

describe("blocks field", () => {
    it("compiles with the blocks kind and carries BlockDocument values", () => {
        const body = blocks({ required: true });

        expect(body.kind).toBe("blocks");
        expect(body.required).toBe(true);
    });

    it("exposes the plain-text slot to Search", () => {
        const body = blocks();

        expect(capsuleOf(body).searchText()).toEqual({ type: "column-text", slot: "plain" });
    });
});

describe("blockPlainText", () => {
    it("joins text props and rich-text blocks", () => {
        const document: BlockDocument = {
            version: 1,
            blocks: [
                { id: "a", type: "builtin.heading", props: { text: "Hello world", level: 2 } },
                { id: "b", type: "builtin.divider", props: {} },
                {
                    id: "c",
                    type: "builtin.richText",
                    props: {
                        document: {
                            type: "doc",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Body copy" }] }]
                        }
                    }
                }
            ]
        };

        expect(blockPlainText(document)).toBe("Hello world Body copy");
    });

    it("ignores non-text values", () => {
        const document: BlockDocument = {
            version: 1,
            blocks: [{ id: "a", type: "builtin.spacer", props: { size: 3 } }]
        };

        expect(blockPlainText(document)).toBe("");
    });
});

describe("richTextPlainText", () => {
    it("joins text nodes that split a word and separates blocks", () => {
        const text = richTextPlainText({
            type: "doc",
            content: [
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "First" },
                        { type: "text", text: "Second" }
                    ]
                }
            ]
        });

        expect(text).toBe("Title FirstSecond");
    });

    it("indexes hard breaks as word separators and keeps media alternative text", () => {
        const text = richTextPlainText({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Cloudflare" },
                        { type: "hardBreak" },
                        { type: "text", text: "Workers" }
                    ]
                },
                { type: "mediaImage", attrs: { mediaId: "media-1", alt: "deployment diagram" } }
            ]
        });

        expect(text).toBe("Cloudflare Workers deployment diagram");
    });
});

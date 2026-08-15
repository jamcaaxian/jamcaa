import { describe, expect, it } from "vitest";
import { blockPlainText, defineBlock, parseBlockDocument, validateBlockProps, type BlockDocument } from "./blocks";
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

    it("lets a Block declaration exclude implementation details from Search", () => {
        const definition = defineBlock({
            name: "test.linkCard",
            label: "Link card",
            props: { title: { kind: "text", label: "Title" }, href: { kind: "link", label: "Address" } },
            plainText: props => String(props.title ?? "")
        });
        const document: BlockDocument = {
            version: 1,
            blocks: [{ id: "card", type: definition.name, props: { title: "Read the guide", href: "/private-path" } }]
        };

        expect(blockPlainText(document, { [definition.name]: definition })).toBe("Read the guide");
    });

    it("indexes nothing when a declared Block owns no Search projection", () => {
        const definition = defineBlock({
            name: "test.integration",
            label: "Integration",
            props: { secret: { kind: "text", label: "Secret" } }
        });
        const document: BlockDocument = {
            version: 1,
            blocks: [{ id: "integration", type: definition.name, props: { secret: "do-not-index" } }]
        };

        expect(blockPlainText(document, { [definition.name]: definition })).toBe("");
    });
});

describe("Block validation", () => {
    it("rejects duplicate and blank block ids", () => {
        const divider = defineBlock({ name: "test.divider", label: "Divider", props: {} });
        const parsed = parseBlockDocument(
            {
                version: 1,
                blocks: [
                    { id: "same", type: divider.name, props: {} },
                    { id: "same", type: divider.name, props: {} },
                    { id: "", type: divider.name, props: {} }
                ]
            },
            { [divider.name]: divider }
        );

        expect(parsed.ok).toBe(false);
        expect(parsed.errors).toContain('Block id "same" is used more than once.');
        expect(parsed.errors).toContain("Every block needs an id and a type.");
        expect(parsed.document.blocks).toHaveLength(1);
    });

    it("validates choice, link and rich-text attributes", () => {
        const definition = defineBlock({
            name: "test.notice",
            label: "Notice",
            props: {
                tone: { kind: "choice", label: "Tone", choices: ["note", "warning"] },
                href: { kind: "link", label: "Address" },
                body: { kind: "richText", label: "Body" }
            }
        });
        const valid = validateBlockProps(definition, {
            tone: "note",
            href: "/docs",
            body: { type: "doc", content: [{ type: "paragraph" }] }
        });
        const invalid = validateBlockProps(definition, {
            tone: "danger",
            href: "javascript:alert(1)",
            body: { type: "unsupported" }
        });

        expect(valid.ok).toBe(true);
        expect(invalid.ok).toBe(false);
        expect(invalid.errors).toHaveLength(3);
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

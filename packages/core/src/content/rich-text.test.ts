import { describe, expect, it } from "vitest";
import {
    emptyRichText,
    isRichTextEmpty,
    parseRichText,
    renderRichTextToHtml,
    richTextFromPlainText,
    richTextToPlainText
} from "./rich-text";

describe("the rich text interface", () => {
    it("recognises an empty body by structure rather than JSON length", () => {
        expect(isRichTextEmpty(emptyRichText())).toBe(true);
        expect(isRichTextEmpty(richTextFromPlainText("A body"))).toBe(false);
    });

    it("parses only documents from the supported schema", () => {
        expect(parseRichText(JSON.stringify(richTextFromPlainText("Hello")))).toEqual(richTextFromPlainText("Hello"));
        expect(() => parseRichText('{"type":"html","content":[]}')).toThrow(/unsupported rich text node/i);
        expect(() => parseRichText("not json")).toThrow(/valid JSON/i);
    });

    it("rejects nodes outside the ProseMirror content expressions", () => {
        expect(() => parseRichText({ type: "doc", content: [] })).toThrow(/invalid children/i);
        expect(() =>
            parseRichText({
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "heading", attrs: { level: 2 } }] }]
            })
        ).toThrow(/invalid children/i);
        expect(() =>
            parseRichText({ type: "doc", content: [{ type: "bulletList", content: [{ type: "paragraph" }] }] })
        ).toThrow(/invalid children/i);
        expect(() =>
            parseRichText({
                type: "doc",
                content: [{ type: "codeBlock", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] }]
            })
        ).toThrow(/invalid children/i);
        expect(() =>
            parseRichText({
                type: "doc",
                content: [{ type: "mediaImage", attrs: { mediaId: "../settings", alt: "" } }]
            })
        ).toThrow(/Media identifier/i);
        expect(() =>
            parseRichText({
                type: "doc",
                content: [
                    {
                        type: "mediaImage",
                        attrs: { mediaId: "00000000-0000-4000-8000-000000000001", alt: "Diagram", src: "/settings" }
                    }
                ]
            })
        ).toThrow(/unsupported.*attribute/i);
    });

    it("accepts StarterKit list structure and escapes code blocks literally", () => {
        const body = parseRichText({
            type: "doc",
            content: [
                {
                    type: "bulletList",
                    content: [
                        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] }
                    ]
                },
                { type: "codeBlock", attrs: { language: "html" }, content: [{ type: "text", text: "<b>\n" }] }
            ]
        });

        expect(renderRichTextToHtml(body)).toBe(
            '<ul><li><p>One</p></li></ul><pre><code class="language-html">&lt;b&gt;\n</code></pre>'
        );
    });

    it("canonicalises the code-block language default used by the browser schema", () => {
        expect(
            parseRichText({
                type: "doc",
                content: [{ type: "codeBlock", content: [{ type: "text", text: "const answer = 42;" }] }]
            })
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "codeBlock",
                    attrs: { language: null },
                    content: [{ type: "text", text: "const answer = 42;" }]
                }
            ]
        });
    });

    it("accepts marks Tiptap preserves on a hard break", () => {
        const body = parseRichText({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Before", marks: [{ type: "bold" }] },
                        { type: "hardBreak", marks: [{ type: "bold" }] },
                        { type: "text", text: "After", marks: [{ type: "bold" }] }
                    ]
                }
            ]
        });

        expect(renderRichTextToHtml(body)).toBe("<p><strong>Before</strong><br><strong>After</strong></p>");
    });

    it("revalidates a typed document at the renderer boundary", () => {
        const forged = {
            type: "doc",
            content: [
                {
                    type: "heading",
                    attrs: { level: '1><img src=x onerror="alert(1)"><h1' },
                    content: [{ type: "text", text: "Title" }]
                }
            ]
        } as unknown as Parameters<typeof renderRichTextToHtml>[0];

        expect(() => renderRichTextToHtml(forged)).toThrow(/heading needs a level/i);
    });

    it("renders text and links without trusting stored input", () => {
        expect(() =>
            parseRichText({
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            {
                                type: "text",
                                text: "blocked",
                                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }]
                            }
                        ]
                    }
                ]
            })
        ).toThrow(/link needs an address/i);

        const body = parseRichText({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "<script>", marks: [{ type: "bold" }] },
                        {
                            type: "text",
                            text: " safe",
                            marks: [{ type: "link", attrs: { href: "https://jamcaa.com" } }]
                        }
                    ]
                }
            ]
        });

        expect(renderRichTextToHtml(body)).toBe(
            '<p><strong>&lt;script&gt;</strong><a href="https://jamcaa.com" rel="noopener noreferrer"> safe</a></p>'
        );
    });

    it("renders Media through a caller-provided address seam", () => {
        const body = parseRichText({
            type: "doc",
            content: [
                { type: "mediaImage", attrs: { mediaId: "00000000-0000-4000-8000-000000000001", alt: "A diagram" } }
            ]
        });

        expect(renderRichTextToHtml(body, { mediaAddress: id => `/media/${id}` })).toBe(
            '<figure><img src="/media/00000000-0000-4000-8000-000000000001" alt="A diagram" loading="lazy"></figure>'
        );
    });

    it("extracts searchable text including image alternatives", () => {
        const body = parseRichText({
            type: "doc",
            content: [
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Install" }] },
                {
                    type: "mediaImage",
                    attrs: { mediaId: "00000000-0000-4000-8000-000000000001", alt: "Architecture diagram" }
                }
            ]
        });

        expect(richTextToPlainText(body)).toBe("Install\nArchitecture diagram");
    });
});

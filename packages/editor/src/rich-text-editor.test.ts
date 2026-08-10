import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { parseRichText } from "@jamcaa/core/content";
import { richTextDocumentForSubmission, richTextExtensions } from "./rich-text-editor";

describe("the browser and core rich text compatibility contract", () => {
    const schema = getSchema(richTextExtensions());
    const mediaSchema = getSchema(richTextExtensions(mediaId => `/media/${mediaId}`));

    it("round-trips ordered lists and links without browser-only attributes", () => {
        const document = parseRichText({
            type: "doc",
            content: [
                {
                    type: "orderedList",
                    attrs: { start: 3 },
                    content: [
                        {
                            type: "listItem",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [
                                        {
                                            type: "text",
                                            text: "Jamcaa",
                                            marks: [{ type: "link", attrs: { href: "https://jamcaa.com" } }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        const browserDocument = schema.nodeFromJSON(document).toJSON();

        expect(browserDocument).toEqual(document);
        expect(richTextDocumentForSubmission(browserDocument)).toEqual(document);
    });

    it("round-trips code-block defaults and Media attributes without rewriting persisted JSON", () => {
        const document = parseRichText({
            type: "doc",
            content: [
                { type: "codeBlock", content: [{ type: "text", text: "const answer = 42;" }] },
                {
                    type: "mediaImage",
                    attrs: { mediaId: "00000000-0000-4000-8000-000000000001", alt: "Architecture diagram" }
                }
            ]
        });

        const browserDocument = mediaSchema.nodeFromJSON(document).toJSON();

        expect(browserDocument).toEqual(document);
        expect(richTextDocumentForSubmission(browserDocument)).toEqual(document);
    });

    it("rejects invalid persisted Media attributes at the browser schema boundary", () => {
        expect(() =>
            mediaSchema.nodeFromJSON({
                type: "doc",
                content: [{ type: "mediaImage", attrs: { mediaId: "../settings", alt: "Diagram" } }]
            })
        ).toThrow(/Media identifier/i);

        expect(() =>
            mediaSchema.nodeFromJSON({
                type: "doc",
                content: [{ type: "mediaImage", attrs: { mediaId: "00000000-0000-4000-8000-000000000001", alt: 7 } }]
            })
        ).toThrow(/alternative/i);
        expect(() =>
            richTextDocumentForSubmission({
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

    it("rejects ordered-list and link attributes outside the persisted contract", () => {
        expect(
            schema
                .nodeFromJSON({
                    type: "doc",
                    content: [
                        {
                            type: "orderedList",
                            attrs: { start: 1, type: "A" },
                            content: [{ type: "listItem", content: [{ type: "paragraph" }] }]
                        }
                    ]
                })
                .toJSON()
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "orderedList",
                    attrs: { start: 1 },
                    content: [{ type: "listItem", content: [{ type: "paragraph" }] }]
                }
            ]
        });

        expect(
            schema
                .nodeFromJSON({
                    type: "doc",
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: "Jamcaa",
                                    marks: [{ type: "link", attrs: { href: "https://jamcaa.com", target: "_blank" } }]
                                }
                            ]
                        }
                    ]
                })
                .toJSON()
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: "Jamcaa",
                            marks: [{ type: "link", attrs: { href: "https://jamcaa.com" } }]
                        }
                    ]
                }
            ]
        });
    });

    it("does not parse links with executable protocols", () => {
        const schema = getSchema(richTextExtensions());
        const link = schema.marks.link;
        const validate = link?.spec.attrs?.href?.validate;
        const parseLink = link?.spec.parseDOM?.[0]?.getAttrs;

        expect(typeof validate).toBe("function");
        expect(typeof validate === "function" ? validate("https://jamcaa.com") : undefined).toBe(true);
        expect(typeof validate === "function" ? validate("javascript:alert(1)") : undefined).toBe(false);
        expect(typeof parseLink).toBe("function");
        expect(
            typeof parseLink === "function" ?
                (parseLink as (node: HTMLElement) => unknown)({
                    getAttribute: () => "javascript:alert(1)"
                } as unknown as HTMLElement)
            :   undefined
        ).toBe(false);
    });
});

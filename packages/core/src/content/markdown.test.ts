import { describe, expect, it } from "vitest";
import { richTextFromMarkdown } from "./markdown";

describe("richTextFromMarkdown", () => {
    it("converts headings, paragraphs, and soft line breaks", () => {
        expect(
            richTextFromMarkdown(`# One Title

First sentence
continues here.
`)
        ).toEqual({
            type: "doc",
            content: [
                { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "One Title" }] },
                { type: "paragraph", content: [{ type: "text", text: "First sentence continues here." }] }
            ]
        });
    });

    it("converts nested bullet and ordered lists", () => {
        expect(
            richTextFromMarkdown(`- one
  - nested
- two
1. first
2. second
`)
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "bulletList",
                    content: [
                        {
                            type: "listItem",
                            content: [
                                { type: "paragraph", content: [{ type: "text", text: "one" }] },
                                {
                                    type: "bulletList",
                                    content: [
                                        {
                                            type: "listItem",
                                            content: [
                                                { type: "paragraph", content: [{ type: "text", text: "nested" }] }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] }
                    ]
                },
                {
                    type: "orderedList",
                    attrs: { start: 1 },
                    content: [
                        {
                            type: "listItem",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }]
                        },
                        {
                            type: "listItem",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "second" }] }]
                        }
                    ]
                }
            ]
        });
    });

    it("converts inline code, links, bold, and italic", () => {
        expect(
            richTextFromMarkdown("Use `capsuleOf` and **bold** and *soft* and [docs](https://example.com).")
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Use " },
                        { type: "text", text: "capsuleOf", marks: [{ type: "code" }] },
                        { type: "text", text: " and " },
                        { type: "text", text: "bold", marks: [{ type: "bold" }] },
                        { type: "text", text: " and " },
                        { type: "text", text: "soft", marks: [{ type: "italic" }] },
                        { type: "text", text: " and " },
                        {
                            type: "text",
                            text: "docs",
                            marks: [{ type: "link", attrs: { href: "https://example.com" } }]
                        },
                        { type: "text", text: "." }
                    ]
                }
            ]
        });
    });

    it("drops unsafe link targets and keeps the label", () => {
        expect(richTextFromMarkdown("[unsafe](javascript:alert(1))").content).toEqual([
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "unsafe" },
                    { type: "text", text: ")" }
                ]
            }
        ]);
    });

    it("converts block quotes, fenced code, and horizontal rules", () => {
        expect(
            richTextFromMarkdown(`> quoted words
> on one line

\`\`\`ts
const x = 1;
\`\`\`

---
`)
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "blockquote",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "quoted words on one line" }] }]
                },
                { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;\n" }] },
                { type: "horizontalRule" }
            ]
        });
    });

    it("converts tables into bullet items of pipe-joined rows", () => {
        expect(
            richTextFromMarkdown(`| A | B |
| - | - |
| 1 | 2 |
`)
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "bulletList",
                    content: [
                        {
                            type: "listItem",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "A | B" }] }]
                        },
                        {
                            type: "listItem",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "1 | 2" }] }]
                        }
                    ]
                }
            ]
        });
    });

    it("parses inline syntax inside table cells and bold marks", () => {
        expect(
            richTextFromMarkdown(`| Label | Meaning |
| - | - |
| \`needs-triage\` | \`ready-for-agent\` |

**\`CONTEXT.md\`** at the repo root
`)
        ).toEqual({
            type: "doc",
            content: [
                {
                    type: "bulletList",
                    content: [
                        {
                            type: "listItem",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Label | Meaning" }] }]
                        },
                        {
                            type: "listItem",
                            content: [
                                {
                                    type: "paragraph",
                                    content: [
                                        { type: "text", text: "needs-triage", marks: [{ type: "code" }] },
                                        { type: "text", text: " | " },
                                        { type: "text", text: "ready-for-agent", marks: [{ type: "code" }] }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "CONTEXT.md", marks: [{ type: "code" }, { type: "bold" }] },
                        { type: "text", text: " at the repo root" }
                    ]
                }
            ]
        });
    });

    it("keeps empty fenced code blocks valid", () => {
        expect(richTextFromMarkdown("```\n```\n")).toEqual({
            type: "doc",
            content: [{ type: "codeBlock", attrs: { language: null } }]
        });
    });
});

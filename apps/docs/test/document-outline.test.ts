import { describe, expect, it } from "vitest";
import { documentOutline, headingIdFactory } from "@/content/document-outline";

describe("documentation heading anchors", () => {
    it("keeps duplicate and non-Latin headings deterministic", () => {
        const idFor = headingIdFactory();

        expect(idFor({ level: 2, text: "Getting started" })).toBe("getting-started");
        expect(idFor({ level: 3, text: "Getting started" })).toBe("getting-started-2");
        expect(idFor({ level: 2, text: "快速开始" })).toBe("快速开始");
    });

    it("collects headings from built-in and Rich Text Blocks in render order", () => {
        expect(
            documentOutline({
                version: 1,
                blocks: [
                    { id: "one", type: "builtin.heading", props: { level: 2, text: "Overview" } },
                    {
                        id: "two",
                        type: "builtin.richText",
                        props: {
                            document: {
                                type: "doc",
                                content: [
                                    {
                                        type: "heading",
                                        attrs: { level: 2 },
                                        content: [{ type: "text", text: "Install" }]
                                    },
                                    {
                                        type: "heading",
                                        attrs: { level: 3 },
                                        content: [{ type: "text", text: "Install" }]
                                    }
                                ]
                            }
                        }
                    }
                ]
            })
        ).toEqual([
            { id: "overview", level: 2, text: "Overview" },
            { id: "install", level: 2, text: "Install" },
            { id: "install-2", level: 3, text: "Install" }
        ]);
    });
});

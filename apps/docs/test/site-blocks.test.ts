import { describe, expect, it } from "vitest";
import { blockPlainText, parseBlockDocument, type BlockDocument } from "@jamcaaxian/core/content";
import {
    docsDocumentPresentation,
    docsSidebarBlock,
    siteBlockRegistry,
    visibleSiteDocument
} from "@/content/site-blocks";

function document(blocks: BlockDocument["blocks"]): BlockDocument {
    return { version: 1, blocks };
}

describe("Site-owned documentation Blocks", () => {
    it("validates sidebar defaults through the Site registry", () => {
        const parsed = parseBlockDocument(
            document([{ id: "sidebar", type: docsSidebarBlock.name, props: {} }]),
            siteBlockRegistry
        );

        expect(parsed.ok).toBe(true);
        expect(parsed.document.blocks[0]?.props).toEqual({ multiLevel: true, autoCollapse: true });
    });

    it("extracts the latest sidebar instruction and removes every instruction from visible content", () => {
        const source = document([
            { id: "first", type: docsSidebarBlock.name, props: { multiLevel: true, autoCollapse: true } },
            { id: "heading", type: "builtin.heading", props: { text: "Reader content", level: 2 } },
            { id: "last", type: docsSidebarBlock.name, props: { multiLevel: false, autoCollapse: false } }
        ]);

        expect(docsDocumentPresentation(source)).toEqual({
            document: document([
                { id: "heading", type: "builtin.heading", props: { text: "Reader content", level: 2 } }
            ]),
            sidebar: { multiLevel: false, autoCollapse: false }
        });
        expect(visibleSiteDocument(source).blocks.map(block => block.type)).toEqual(["builtin.heading"]);
    });

    it("keeps sidebar configuration out of full-text Search", () => {
        const source = document([
            { id: "sidebar", type: docsSidebarBlock.name, props: { multiLevel: true, autoCollapse: true } },
            { id: "heading", type: "builtin.heading", props: { text: "Searchable guide", level: 2 } }
        ]);

        expect(blockPlainText(source, siteBlockRegistry)).toBe("Searchable guide");
    });
});

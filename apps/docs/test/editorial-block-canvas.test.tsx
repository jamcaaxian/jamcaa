import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialBlockCanvas, type EditorialBlockCanvasMessages } from "@/components/admin/editorial-block-canvas";

const messages: EditorialBlockCanvasMessages = {
    addBlock: "Add Block",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    empty: "Empty",
    unknown: "Unknown",
    dragBlock: index => `Drag Block ${index}`
};

function renderCanvas(): string {
    return renderToStaticMarkup(
        createElement(EditorialBlockCanvas, {
            name: "body",
            label: "Blocks",
            defaultValue: { version: 1, blocks: [{ id: "divider", type: "builtin.divider", props: {} }] },
            definitions: [{ name: "builtin.divider", label: "Divider", props: {} }],
            messages
        })
    );
}

function describedBy(markup: string): string | undefined {
    return markup.match(/aria-describedby="([^"]+)"/)?.[1];
}

describe("Editorial Block canvas", () => {
    it("keeps the drag description ID stable across server renders", () => {
        expect([describedBy(renderCanvas()), describedBy(renderCanvas())]).toEqual([
            "body-block-canvas",
            "body-block-canvas"
        ]);
    });
});

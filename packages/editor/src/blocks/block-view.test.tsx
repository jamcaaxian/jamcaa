import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockDocumentView, createBlockViewRegistry, type BlockViewProps } from "./block-view";

function CustomView({ block }: BlockViewProps) {
    return createElement("strong", null, String(block.props.label ?? ""));
}

describe("Block View registry", () => {
    it("renders a Site-owned Block through the registered view", () => {
        const registry = createBlockViewRegistry([{ type: "site.hero", render: CustomView }]);
        const html = renderToStaticMarkup(
            createElement(BlockDocumentView, {
                document: {
                    version: 1,
                    blocks: [{ id: "hero", type: "site.hero", props: { label: "Build at the edge" } }]
                },
                registry
            })
        );

        expect(html).toContain("<strong>Build at the edge</strong>");
    });

    it("rejects duplicate views during assembly", () => {
        expect(() =>
            createBlockViewRegistry([
                { type: "site.hero", render: CustomView },
                { type: "site.hero", render: CustomView }
            ])
        ).toThrow('Block View "site.hero" is registered twice.');
    });
});

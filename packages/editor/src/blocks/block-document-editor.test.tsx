import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { builtinBlocks } from "./builtin";
import { BlockDocumentEditor } from "./block-document-editor";

describe("Block Document Editing Control", () => {
    it("lets a Site label Block choice values without changing submitted values", () => {
        const markup = renderToStaticMarkup(
            createElement(BlockDocumentEditor, {
                name: "body",
                label: "Blocks",
                defaultValue: {
                    version: 1,
                    blocks: [
                        {
                            id: "button",
                            type: builtinBlocks.button.name,
                            props: { label: "Read more", href: "/docs", variant: "secondary" }
                        }
                    ]
                },
                definitions: [builtinBlocks.button],
                choices: {
                    [builtinBlocks.button.name]: {
                        variant: [
                            { value: "primary", label: "主要" },
                            { value: "secondary", label: "次要" },
                            { value: "tertiary", label: "弱化" }
                        ]
                    }
                }
            })
        );

        expect(markup).toContain('<option value="primary">主要</option>');
        expect(markup).toContain('<option value="secondary" selected="">次要</option>');
        expect(markup).toContain('<option value="tertiary">弱化</option>');
        expect(markup).toContain("&quot;variant&quot;:&quot;secondary&quot;");
    });
});

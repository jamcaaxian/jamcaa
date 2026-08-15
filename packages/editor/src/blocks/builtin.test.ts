import { describe, expect, it } from "vitest";
import { parseBlockDocument, validateBlockProps } from "@jamcaaxian/core/content";
import { builtinBlockRegistry, builtinBlocks } from "./builtin";

describe("built-in block declarations", () => {
    it("accepts a heading with its defaults filled", () => {
        const validated = validateBlockProps(builtinBlocks.heading, {});

        expect(validated.ok).toBe(true);
        expect(validated.props).toEqual({ text: "", level: 2 });
    });

    it("rejects a heading level outside the range", () => {
        const validated = validateBlockProps(builtinBlocks.heading, { text: "Hi", level: 7 });

        expect(validated.ok).toBe(false);
        expect(validated.errors.join()).toContain("Level must be 1, 2 or 3");
    });

    it("rejects an image without a media id", () => {
        const validated = validateBlockProps(builtinBlocks.image, { alt: "A photo" });

        expect(validated.ok).toBe(false);
    });

    it("constrains button destinations and visual variants", () => {
        const valid = validateBlockProps(builtinBlocks.button, {
            label: "Get started",
            href: "/docs",
            variant: "tertiary"
        });
        const invalid = validateBlockProps(builtinBlocks.button, {
            label: "Unsafe",
            href: "javascript:alert(1)",
            variant: "rainbow"
        });

        expect(valid.ok).toBe(true);
        expect(invalid.ok).toBe(false);
        expect(invalid.errors).toHaveLength(2);
    });

    it("installs documentation-oriented built-ins", () => {
        expect(Object.keys(builtinBlockRegistry)).toEqual(
            expect.arrayContaining(["builtin.callout", "builtin.feature", "builtin.stat"])
        );
    });

    it("parses a document and reports unknown block types without dropping them", () => {
        const parsed = parseBlockDocument(
            {
                version: 1,
                blocks: [
                    { id: "a", type: "builtin.heading", props: { text: "Hello", level: 1 } },
                    { id: "b", type: "shop.product", props: {} }
                ]
            },
            builtinBlockRegistry
        );

        expect(parsed.ok).toBe(false);
        expect(parsed.errors.join()).toContain('Unknown block type "shop.product"');
        expect(parsed.document.blocks).toHaveLength(2);
        expect(parsed.document.blocks[0]?.props).toEqual({ text: "Hello", level: 1 });
    });

    it("parses a clean document as valid", () => {
        const parsed = parseBlockDocument(
            {
                version: 1,
                blocks: [
                    { id: "a", type: "builtin.divider", props: {} },
                    { id: "b", type: "builtin.spacer", props: { size: 3 } }
                ]
            },
            builtinBlockRegistry
        );

        expect(parsed.ok).toBe(true);
    });
});

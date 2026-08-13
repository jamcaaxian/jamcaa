import { defineBlock, type BlockRegistry } from "@jamcaaxian/core/content";

/**
 * The built-in Block library. Names are namespaced so Sites and plugins can
 * register their own without collision, and so stored bodies stay readable
 * even when a Site renames its local labels.
 */
export const builtinBlocks = {
    heading: defineBlock({
        name: "builtin.heading",
        label: "Heading",
        description: "A section heading.",
        props: {
            text: { kind: "text", label: "Text", default: "" },
            level: { kind: "number", label: "Level", default: 2 }
        },
        check: props =>
            typeof props.level === "number" && props.level >= 1 && props.level <= 3 ?
                undefined
            :   "Level must be 1, 2 or 3."
    }),
    paragraph: defineBlock({
        name: "builtin.paragraph",
        label: "Paragraph",
        props: { text: { kind: "text", label: "Text", default: "" } }
    }),
    richText: defineBlock({
        name: "builtin.richText",
        label: "Rich text",
        description: "Structured long-form content with headings, lists, links and Media.",
        props: { document: { kind: "richText", label: "Document" } }
    }),
    image: defineBlock({
        name: "builtin.image",
        label: "Image",
        props: {
            mediaId: { kind: "mediaId", label: "Media" },
            alt: { kind: "text", label: "Alternative text", default: "" },
            caption: { kind: "text", label: "Caption", default: "" }
        }
    }),
    quote: defineBlock({
        name: "builtin.quote",
        label: "Quote",
        props: {
            text: { kind: "text", label: "Quote", default: "" },
            attribution: { kind: "text", label: "Attribution", default: "" }
        }
    }),
    code: defineBlock({
        name: "builtin.code",
        label: "Code",
        props: {
            language: { kind: "text", label: "Language", default: "" },
            code: { kind: "text", label: "Code", default: "" }
        }
    }),
    button: defineBlock({
        name: "builtin.button",
        label: "Button",
        props: {
            label: { kind: "text", label: "Label", default: "" },
            href: { kind: "text", label: "Address", default: "" },
            variant: { kind: "text", label: "Variant", default: "primary" }
        },
        check: props =>
            typeof props.variant === "string" && ["primary", "secondary"].includes(props.variant) ?
                undefined
            :   'Variant must be "primary" or "secondary".'
    }),
    divider: defineBlock({ name: "builtin.divider", label: "Divider", props: {} }),
    spacer: defineBlock({
        name: "builtin.spacer",
        label: "Spacer",
        props: { size: { kind: "number", label: "Size", default: 2 } },
        check: props =>
            typeof props.size === "number" && props.size >= 1 && props.size <= 6 ?
                undefined
            :   "Size must be between 1 and 6."
    })
} as const;

export const builtinBlockRegistry: BlockRegistry = Object.fromEntries(
    Object.values(builtinBlocks).map(block => [block.name, block])
);

import { defineBlock, richTextPlainText, type BlockRegistry, type RichTextDocument } from "@jamcaaxian/core/content";

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
            :   "Level must be 1, 2 or 3.",
        plainText: props => String(props.text ?? "")
    }),
    paragraph: defineBlock({
        name: "builtin.paragraph",
        label: "Paragraph",
        props: { text: { kind: "text", label: "Text", default: "" } },
        plainText: props => String(props.text ?? "")
    }),
    richText: defineBlock({
        name: "builtin.richText",
        label: "Rich text",
        description: "Structured long-form content with headings, lists, links and Media.",
        props: { document: { kind: "richText", label: "Document" } },
        plainText: props => richTextPlainText(props.document as RichTextDocument)
    }),
    image: defineBlock({
        name: "builtin.image",
        label: "Image",
        props: {
            mediaId: { kind: "mediaId", label: "Media" },
            alt: { kind: "text", label: "Alternative text", default: "" },
            caption: { kind: "text", label: "Caption", default: "" }
        },
        plainText: props => [props.alt, props.caption].filter(value => typeof value === "string").join(" ")
    }),
    quote: defineBlock({
        name: "builtin.quote",
        label: "Quote",
        props: {
            text: { kind: "text", label: "Quote", default: "" },
            attribution: { kind: "text", label: "Attribution", default: "" }
        },
        plainText: props => [props.text, props.attribution].filter(value => typeof value === "string").join(" ")
    }),
    code: defineBlock({
        name: "builtin.code",
        label: "Code",
        props: {
            language: { kind: "text", label: "Language", default: "" },
            code: { kind: "text", label: "Code", default: "" }
        },
        plainText: props => String(props.code ?? "")
    }),
    button: defineBlock({
        name: "builtin.button",
        label: "Button",
        props: {
            label: { kind: "text", label: "Label", default: "" },
            href: { kind: "link", label: "Address", default: "/" },
            variant: {
                kind: "choice",
                label: "Variant",
                choices: ["primary", "secondary", "tertiary"],
                default: "primary"
            }
        },
        plainText: props => String(props.label ?? "")
    }),
    callout: defineBlock({
        name: "builtin.callout",
        label: "Callout",
        description: "A highlighted note, tip, warning or important message.",
        props: {
            tone: { kind: "choice", label: "Tone", choices: ["note", "tip", "warning", "important"], default: "note" },
            title: { kind: "text", label: "Title", default: "" },
            body: { kind: "text", label: "Body", default: "" }
        },
        plainText: props => [props.title, props.body].filter(value => typeof value === "string").join(" ")
    }),
    feature: defineBlock({
        name: "builtin.feature",
        label: "Feature",
        description: "A product capability with an optional destination.",
        props: {
            eyebrow: { kind: "text", label: "Eyebrow", default: "" },
            title: { kind: "text", label: "Title", default: "" },
            description: { kind: "text", label: "Description", default: "" },
            href: { kind: "link", label: "Address", default: "/" }
        },
        plainText: props =>
            [props.eyebrow, props.title, props.description].filter(value => typeof value === "string").join(" ")
    }),
    stat: defineBlock({
        name: "builtin.stat",
        label: "Statistic",
        description: "A concise proof point or product fact.",
        props: {
            value: { kind: "text", label: "Value", default: "" },
            label: { kind: "text", label: "Label", default: "" },
            detail: { kind: "text", label: "Detail", default: "" }
        },
        plainText: props =>
            [props.value, props.label, props.detail].filter(value => typeof value === "string").join(" ")
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

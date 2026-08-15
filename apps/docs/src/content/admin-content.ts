import type { BlockDefinition, EditingField } from "@jamcaaxian/core/content";
import { builtinBlocks } from "@jamcaaxian/editor/blocks";
import type { DocsLocale } from "./locales";

const fieldCopy = {
    "en-US": {
        title: { label: "Title" },
        excerpt: { label: "Excerpt", description: "Shown in listings and search results." },
        body: { label: "Body", description: "A body composed of Blocks. Rich text is one Block among others." }
    },
    "zh-Hans-CN": {
        title: { label: "标题" },
        excerpt: { label: "摘要", description: "显示在内容列表和搜索结果中。" },
        body: { label: "正文", description: "由 Blocks 组合而成；富文本只是其中一种 Block。" }
    }
} as const;

const blockCopy = {
    "en-US": {
        "builtin.heading": {
            label: "Heading",
            description: "A section heading.",
            props: { text: "Text", level: "Level" }
        },
        "builtin.paragraph": { label: "Paragraph", props: { text: "Text" } },
        "builtin.richText": {
            label: "Rich text",
            description: "Structured long-form content with headings, lists, links and Media.",
            props: { document: "Document" }
        },
        "builtin.image": { label: "Image", props: { mediaId: "Media", alt: "Alternative text", caption: "Caption" } },
        "builtin.quote": { label: "Quote", props: { text: "Quote", attribution: "Attribution" } },
        "builtin.code": { label: "Code", props: { language: "Language", code: "Code" } },
        "builtin.button": { label: "Button", props: { label: "Label", href: "Address", variant: "Variant" } },
        "builtin.callout": {
            label: "Callout",
            description: "A highlighted note, tip, warning or important message.",
            props: { tone: "Tone", title: "Title", body: "Body" }
        },
        "builtin.feature": {
            label: "Feature",
            description: "A product capability with an optional destination.",
            props: { eyebrow: "Eyebrow", title: "Title", description: "Description", href: "Address" }
        },
        "builtin.stat": {
            label: "Statistic",
            description: "A concise proof point or product fact.",
            props: { value: "Value", label: "Label", detail: "Detail" }
        },
        "builtin.divider": { label: "Divider", props: {} },
        "builtin.spacer": { label: "Spacer", props: { size: "Size" } }
    },
    "zh-Hans-CN": {
        "builtin.heading": { label: "标题", description: "章节标题。", props: { text: "文字", level: "级别" } },
        "builtin.paragraph": { label: "段落", props: { text: "文字" } },
        "builtin.richText": {
            label: "富文本",
            description: "支持标题、列表、链接和媒体的结构化长内容。",
            props: { document: "文档" }
        },
        "builtin.image": { label: "图片", props: { mediaId: "媒体", alt: "替代文本", caption: "说明" } },
        "builtin.quote": { label: "引用", props: { text: "引用内容", attribution: "出处" } },
        "builtin.code": { label: "代码", props: { language: "语言", code: "代码" } },
        "builtin.button": { label: "按钮", props: { label: "文字", href: "地址", variant: "样式" } },
        "builtin.callout": {
            label: "提示框",
            description: "突出显示注释、技巧、警告或重要信息。",
            props: { tone: "语气", title: "标题", body: "正文" }
        },
        "builtin.feature": {
            label: "功能",
            description: "带有可选跳转地址的产品能力。",
            props: { eyebrow: "眉题", title: "标题", description: "说明", href: "地址" }
        },
        "builtin.stat": {
            label: "数据",
            description: "简洁的事实、指标或证明。",
            props: { value: "数值", label: "名称", detail: "详情" }
        },
        "builtin.divider": { label: "分隔线", props: {} },
        "builtin.spacer": { label: "留白", props: { size: "尺寸" } }
    }
} as const;

export function localizedEditingFields(fields: readonly EditingField[], locale: DocsLocale): EditingField[] {
    const copy = fieldCopy[locale] as Record<string, { label: string; description?: string }>;

    return fields.map(field => {
        const localized = copy[field.name];

        return localized === undefined ? field : { ...field, ...localized };
    });
}

export function localizedBuiltinBlocks(locale: DocsLocale): BlockDefinition[] {
    const copy = blockCopy[locale] as Record<
        string,
        { label: string; description?: string; props: Record<string, string> }
    >;

    return Object.values(builtinBlocks).map(definition => {
        const localized = copy[definition.name];

        if (localized === undefined) {
            return definition;
        }

        return {
            ...definition,
            label: localized.label,
            ...(localized.description === undefined ? {} : { description: localized.description }),
            props: Object.fromEntries(
                Object.entries(definition.props).map(([name, declaration]) => [
                    name,
                    { ...declaration, label: localized.props[name] ?? declaration.label }
                ])
            )
        };
    });
}

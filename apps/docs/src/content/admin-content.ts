import type { BlockDefinition, EditingField } from "@jamcaaxian/core/content";
import type { BlockChoiceOptions } from "@jamcaaxian/editor/blocks";
import type { DocsLocale } from "./locales";
import { siteBlockDefinitions } from "./site-blocks";

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

const blockChoiceCopy: Record<DocsLocale, BlockChoiceOptions> = {
    "en-US": {
        "builtin.button": {
            variant: [
                { value: "primary", label: "Primary" },
                { value: "secondary", label: "Secondary" },
                { value: "tertiary", label: "Tertiary" }
            ]
        },
        "builtin.callout": {
            tone: [
                { value: "note", label: "Note" },
                { value: "tip", label: "Tip" },
                { value: "warning", label: "Warning" },
                { value: "important", label: "Important" }
            ]
        }
    },
    "zh-Hans-CN": {
        "builtin.button": {
            variant: [
                { value: "primary", label: "主要" },
                { value: "secondary", label: "次要" },
                { value: "tertiary", label: "弱化" }
            ]
        },
        "builtin.callout": {
            tone: [
                { value: "note", label: "备注" },
                { value: "tip", label: "提示" },
                { value: "warning", label: "警告" },
                { value: "important", label: "重要" }
            ]
        }
    }
};

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
        "builtin.spacer": { label: "Spacer", props: { size: "Size" } },
        "docs.sidebar": {
            label: "Documentation sidebar",
            description: "Controls this document's public navigation and is not rendered in the body.",
            props: { multiLevel: "Multi-level menu", autoCollapse: "Automatically collapse other sections" },
            propDescriptions: {
                multiLevel: "Groups related documents into collapsible sections.",
                autoCollapse: "Keeps only one sibling section open at a time."
            }
        }
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
        "builtin.spacer": { label: "留白", props: { size: "尺寸" } },
        "docs.sidebar": {
            label: "文档侧栏",
            description: "控制当前文档的公开导航，不会显示在正文中。",
            props: { multiLevel: "启用多级菜单", autoCollapse: "自动收起其他目录" },
            propDescriptions: {
                multiLevel: "按内容关系分组，并允许读者展开或收起子目录。",
                autoCollapse: "展开一个目录时自动收起同级的其他目录。"
            }
        }
    }
} as const;

export function localizedEditingFields(fields: readonly EditingField[], locale: DocsLocale): EditingField[] {
    const copy = fieldCopy[locale] as Record<string, { label: string; description?: string }>;

    return fields.map(field => {
        const localized = copy[field.name];

        return localized === undefined ? field : { ...field, ...localized };
    });
}

export function localizedSiteBlocks(locale: DocsLocale): BlockDefinition[] {
    const copy = blockCopy[locale] as Record<
        string,
        {
            label: string;
            description?: string;
            props: Record<string, string>;
            propDescriptions?: Record<string, string>;
        }
    >;

    return siteBlockDefinitions.map(definition => {
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
                    {
                        ...declaration,
                        label: localized.props[name] ?? declaration.label,
                        ...(localized.propDescriptions?.[name] === undefined ?
                            {}
                        :   { description: localized.propDescriptions[name] })
                    }
                ])
            )
        };
    });
}

export function localizedSiteBlockChoices(locale: DocsLocale): BlockChoiceOptions {
    return blockChoiceCopy[locale];
}

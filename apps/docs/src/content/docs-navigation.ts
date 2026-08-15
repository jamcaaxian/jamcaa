import { localizedPath, type DocsLocale } from "./locales";
import { publicCopy } from "./public-copy";

interface NavigationDocument {
    slug: string;
    labels: Record<DocsLocale, string>;
}

const documents: readonly NavigationDocument[] = [
    { slug: "docs", labels: { "en-US": "Documentation", "zh-Hans-CN": "文档" } },
    { slug: "getting-started", labels: { "en-US": "Getting started", "zh-Hans-CN": "快速开始" } },
    { slug: "guides", labels: { "en-US": "Guides", "zh-Hans-CN": "教程" } },
    { slug: "blocks", labels: { "en-US": "Composable Blocks", "zh-Hans-CN": "可组合 Blocks" } },
    { slug: "localization", labels: { "en-US": "Localization", "zh-Hans-CN": "本地化" } },
    { slug: "reference", labels: { "en-US": "Reference", "zh-Hans-CN": "参考" } },
    { slug: "api-reference", labels: { "en-US": "API Reference", "zh-Hans-CN": "API 参考" } },
    { slug: "changelog", labels: { "en-US": "Changelog", "zh-Hans-CN": "更新日志" } }
];

function item(document: NavigationDocument, locale: DocsLocale) {
    return { slug: document.slug, label: document.labels[locale], href: localizedPath(locale, `/${document.slug}`) };
}

export function docsTopNavigation(locale: DocsLocale) {
    const messages = publicCopy(locale);

    return [
        { label: messages.docs, href: localizedPath(locale, "/docs") },
        { label: messages.guides, href: localizedPath(locale, "/guides") },
        { label: messages.reference, href: localizedPath(locale, "/reference") },
        { label: messages.changelog, href: localizedPath(locale, "/changelog") }
    ];
}

export function docsSidebarNavigation(locale: DocsLocale) {
    const messages = publicCopy(locale);
    const bySlug = new Map(documents.map(document => [document.slug, item(document, locale)]));

    return [
        { label: messages.docs, items: [bySlug.get("docs")!, bySlug.get("getting-started")!] },
        { label: messages.guides, items: [bySlug.get("guides")!, bySlug.get("blocks")!, bySlug.get("localization")!] },
        {
            label: messages.reference,
            items: [bySlug.get("reference")!, bySlug.get("api-reference")!, bySlug.get("changelog")!]
        }
    ];
}

export function adjacentDocs(slug: string, locale: DocsLocale) {
    const index = documents.findIndex(document => document.slug === slug);

    if (index === -1) {
        return {};
    }

    return {
        previous: index > 0 ? item(documents[index - 1]!, locale) : undefined,
        next: index < documents.length - 1 ? item(documents[index + 1]!, locale) : undefined
    };
}

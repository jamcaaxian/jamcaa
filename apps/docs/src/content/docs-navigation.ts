import { localizedPath, type DocsLocale } from "./locales";
import { publicCopy } from "./public-copy";

interface NavigationDocument {
    slug: string;
    labels: Record<DocsLocale, string>;
}

interface NavigationSection {
    root: string;
    children: readonly string[];
}

export interface DocsNavigationItem {
    slug: string;
    label: string;
    href: string;
}

export interface DocsNavigationSection {
    id: string;
    root: DocsNavigationItem;
    children: DocsNavigationItem[];
}

const documents: readonly NavigationDocument[] = [
    { slug: "docs", labels: { "en-US": "Documentation overview", "zh-Hans-CN": "文档概览" } },
    { slug: "getting-started", labels: { "en-US": "Getting started", "zh-Hans-CN": "快速开始" } },
    { slug: "guides", labels: { "en-US": "Guides", "zh-Hans-CN": "使用指南" } },
    { slug: "blocks", labels: { "en-US": "Composable Blocks", "zh-Hans-CN": "可组合 Block" } },
    { slug: "localization", labels: { "en-US": "Localization", "zh-Hans-CN": "本地化与 Locale" } },
    { slug: "reference", labels: { "en-US": "Platform reference", "zh-Hans-CN": "Platform 参考" } },
    { slug: "api-reference", labels: { "en-US": "API Reference", "zh-Hans-CN": "API 参考" } },
    { slug: "changelog", labels: { "en-US": "Changelog", "zh-Hans-CN": "更新日志" } }
];

const sections: readonly NavigationSection[] = [
    { root: "docs", children: ["getting-started"] },
    { root: "guides", children: ["blocks", "localization"] },
    { root: "reference", children: ["api-reference", "changelog"] }
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
    const bySlug = new Map(documents.map(document => [document.slug, item(document, locale)]));

    return sections.map(section => ({
        id: section.root,
        root: bySlug.get(section.root)!,
        children: section.children.map(slug => bySlug.get(slug)!)
    })) satisfies DocsNavigationSection[];
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

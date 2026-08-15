import { richTextFromMarkdown, type BlockDocument, type RichTextDocument } from "@jamcaaxian/core/content";
import { entryStore } from "@jamcaaxian/core/content";
import type { Collection, ContentModel } from "@jamcaaxian/core/content";
import type { Database } from "@jamcaaxian/core/db";
import { docsLocales, localizedPath, type DocsLocale } from "../src/content/locales";

/** One repository document, ready to become one published Post. */
export interface DocSource {
    /** Stable Entry slug; the migration's identity for the document. */
    slug: string;
    title: string;
    markdown: string;
    locale?: DocsLocale;
    translationId?: string;
}

export interface MigrateDocsContentResult {
    created: number;
    updated: number;
}

function blockDocumentFromRichText(document: RichTextDocument): BlockDocument {
    return { version: 1, blocks: [{ id: "body", type: "builtin.richText", props: { document } }] };
}

/** The path a document had in the repository, minus its .md suffix. */
export function docSlug(relativePath: string): string {
    const normalized = relativePath.replaceAll("\\", "/");
    const base = normalized.split("/").pop()?.replace(/\.md$/i, "") ?? normalized;

    if (normalized === "CONTEXT.md") {
        return "context";
    }

    if (normalized === "README.md") {
        return "readme";
    }

    if (normalized.startsWith("docs/adr/")) {
        return `adr-${base}`;
    }

    if (normalized.startsWith("docs/agents/")) {
        return `agents-${base}`;
    }

    return base.toLowerCase();
}

export function docTitle(markdown: string, fallback: string): string {
    const match = /^#\s+(.+)$/m.exec(markdown);

    return match === null ? fallback : match[1]!.trim();
}

export function docExcerpt(body: RichTextDocument): string {
    for (const node of body.content) {
        if (node.type !== "paragraph") {
            continue;
        }

        const text = (node.content ?? [])
            .map(child => (child.type === "text" ? (child.text ?? "") : " "))
            .join("")
            .trim();

        if (text) {
            return text.slice(0, 200);
        }
    }

    return "";
}

/**
 * Writes repository Markdown documents as published Posts. Documents are
 * identified by slug, so re-running replaces existing Entries instead of
 * duplicating them.
 */
export async function migrateDocsContent(options: {
    database: Database;
    collection: Collection;
    table: ContentModel["tables"][string];
    authorId: string;
    categoryId: string;
    sources: readonly DocSource[];
}): Promise<MigrateDocsContentResult> {
    const { database, collection, table, authorId, categoryId } = options;
    const store = entryStore({ database, collection, table });
    let created = 0;
    let updated = 0;

    for (const source of [...options.sources].sort((left, right) => left.slug.localeCompare(right.slug))) {
        const body = richTextFromMarkdown(source.markdown);
        const title = source.title || docTitle(source.markdown, source.slug);
        const excerpt = docExcerpt(body);
        const existing = await store.bySlug(source.slug, source.locale);

        if (existing === undefined) {
            await store.create({
                slug: source.slug,
                ...(source.locale === undefined ? {} : { locale: source.locale }),
                ...(source.translationId === undefined ? {} : { translationId: source.translationId }),
                authorId,
                categoryId,
                status: "published",
                publishedAt: new Date(),
                title,
                excerpt,
                body
            });
            created += 1;
        } else {
            await store.update(existing.id, { title, excerpt, body });
            updated += 1;
        }
    }

    return { created, updated };
}

/** Turns the repository documents passed into the Worker into DocSources. */
export function docSourcesFromRecord(record: Record<string, string>): DocSource[] {
    return Object.entries(record)
        .map(([path, markdown]) => ({
            slug: docSlug(path),
            title: docTitle(markdown, path.split("/").pop()?.replace(/\.md$/i, "") ?? path),
            markdown
        }))
        .sort((left, right) => left.slug.localeCompare(right.slug));
}

export interface RepositoryPost {
    slug: string;
    locale: DocsLocale;
    translationId: string;
    title: string;
    excerpt: string;
    body: BlockDocument;
}

export interface RepositoryPage {
    address: string;
    locale: DocsLocale;
    translationId: string;
    title: string;
    body: BlockDocument;
}

/** One converted, publishable Post per repository document. */
export function repositoryPosts(record: Record<string, string>): RepositoryPost[] {
    return docSourcesFromRecord(record).map(source => {
        const body = richTextFromMarkdown(source.markdown);

        return {
            slug: source.slug,
            locale: "en-US",
            translationId: `repository:${source.slug}`,
            title: source.title,
            excerpt: docExcerpt(body),
            body: blockDocumentFromRichText(body)
        };
    });
}

interface ProductDocument {
    slug: string;
    translationId: string;
    title: Record<DocsLocale, string>;
    excerpt: Record<DocsLocale, string>;
    markdown: Record<DocsLocale, string>;
}

const productDocuments: readonly ProductDocument[] = [
    {
        slug: "docs",
        translationId: "product:docs",
        title: { "en-US": "Documentation", "zh-Hans-CN": "文档" },
        excerpt: {
            "en-US": "Understand Jamcaa's derived publishing contracts, Site boundaries and Cloudflare runtime.",
            "zh-Hans-CN": "了解 Jamcaa 派生的发布契约、Site 边界与 Cloudflare 运行时。"
        },
        markdown: {
            "en-US": `# Documentation

Jamcaa is a pre-alpha, schema-driven publishing Platform for Cloudflare Workers. A Site declares Collections and Fields in TypeScript; the Platform derives the publishing artifacts that must stay consistent.

## Start with one Collection declaration

A Collection defines one kind of Entry. Its Fields determine storage shape, validation, Editing Control descriptions, typed reads and writes, Entry Summary projection, Revision encoding and Search artifacts.

## Keep Site boundaries explicit

Jamcaa does not generate a product's routes or visual output. Pages, public components and Block View registries remain Site-owned, while the reusable Platform keeps content contracts aligned.

## Run the implemented paths

The reference Docs Site exercises Pages, Entries, Blocks, Taxonomy, Media, Preview, Revisions, FTS5 Search, JSON Feed and Locale-partitioned public routes on Next.js and Cloudflare Workers.

## Know the current boundary

Jamcaa is pre-alpha and Cloudflare-first. Public APIs may change before 1.0, and several broader plugin contracts are still being designed rather than promised as finished features.

## Next steps

- Follow Getting Started to run and initialize the reference Site.
- Read Composable Blocks before defining a Site-owned Block vocabulary.
- Use the API map to locate the Stores, registries and adapters used by the Docs Site.`,
            "zh-Hans-CN": `# 文档

Jamcaa 是一个面向 Cloudflare Workers、处于 pre-alpha 阶段的声明式内容发布 Platform。Site 在 TypeScript 中声明 Collection 与 Field，Platform 据此派生必须保持一致的发布产物。

## 从一份 Collection 声明开始

Collection 定义一种 Entry。Field 决定存储形态、校验、Editing Control 描述、类型化读写、Entry Summary 投影、Revision 编解码与 Search 产物。

## 明确 Site 边界

Jamcaa 不会生成产品路由或视觉输出。Page、公开组件与 Block View Registry 仍由 Site 负责；可复用 Platform 则保持内容契约一致。

## 运行已经实现的链路

参考 Docs Site 在 Next.js 与 Cloudflare Workers 上实际运行 Page、Entry、Block、Taxonomy、Media、Preview、Revision、FTS5 Search、JSON Feed 与按 Locale 分区的公开路由。

## 了解当前边界

Jamcaa 仍处于 pre-alpha，并且以 Cloudflare 为首要运行环境。1.0 之前公开 API 可能发生破坏性变化，一些更广泛的插件契约仍在设计中，而不是已完成能力。

## 下一步

- 按快速开始运行并初始化参考 Site。
- 定义 Site 自有 Block 词汇前先阅读可组合 Blocks。
- 通过 API 地图定位 Docs Site 使用的 Store、Registry 与 Adapter。`
        }
    },
    {
        slug: "guides",
        translationId: "product:guides",
        title: { "en-US": "Guides", "zh-Hans-CN": "教程" },
        excerpt: {
            "en-US": "Practical paths through the reference Site's content, publishing and runtime contracts.",
            "zh-Hans-CN": "沿参考 Site 实际使用的内容、发布与运行时契约推进。"
        },
        markdown: {
            "en-US": `# Guides

Use these guides to follow the implemented publishing paths in the reference Docs Site.

## Run and initialize the Site

Start with Getting Started. It installs the workspace, applies D1 migrations, starts Next.js and opens the first-administrator setup flow.

## Model composable bodies

Read Composable Blocks before defining Site-specific page sections. Blocks own typed Props, validation and plain-text projection; the Site owns visual views.

## Design Locale identity deliberately

Read Localization before importing variants. Locale partitions Entries, Pages, routes, Former Addresses, Entry Summaries, Search cursors and Feed output. The current admin does not yet provide a complete translation-creation workflow.

## Operate the Cloudflare runtime

The reference Site deploys through OpenNext to Cloudflare Workers with D1, R2 and a Durable Object counters Worker. Apply and verify migrations before publishing content remotely.`,
            "zh-Hans-CN": `# 教程

沿这些教程运行参考 Docs Site 已经实现的发布链路。

## 运行并初始化 Site

从快速开始入手：安装 Workspace、应用 D1 迁移、启动 Next.js，并进入首位管理员初始化流程。

## 建模可组合正文

定义 Site 专属页面区块前先阅读可组合 Blocks。Block 负责类型化 Props、校验与纯文本投影，Site 负责视觉 View。

## 明确设计 Locale 身份

导入多语言版本前阅读本地化。Locale 会分区 Entry、Page、路由、Former Address、Entry Summary、Search Cursor 与 Feed 输出。当前管理端尚未提供完整的翻译创建流程。

## 运行 Cloudflare 环境

参考 Site 通过 OpenNext 部署到 Cloudflare Workers，并使用 D1、R2 与 Durable Object 计数 Worker。远程发布内容前先应用并验证迁移。`
        }
    },
    {
        slug: "getting-started",
        translationId: "product:getting-started",
        title: { "en-US": "Getting started", "zh-Hans-CN": "快速开始" },
        excerpt: {
            "en-US": "Run the reference Site locally, apply D1 migrations and create its first administrator.",
            "zh-Hans-CN": "在本地运行参考 Site、应用 D1 迁移并创建首位管理员。"
        },
        markdown: {
            "en-US": `# Getting started

This guide runs the Jamcaa documentation Site, the reference implementation that exercises the Platform and optional Editor package together.

## Prerequisites

- Node.js and pnpm
- The repository's local Cloudflare bindings and secrets
- Windows Developer Mode before OpenNext builds on Windows

## Install the workspace

\`\`\`bash
pnpm install
\`\`\`

## Apply migrations

\`\`\`bash
pnpm --filter @jamcaaxian/docs db:migrate
pnpm --filter @jamcaaxian/docs db:docs:migrate
\`\`\`

## Start the Site

\`\`\`bash
pnpm --filter @jamcaaxian/docs dev
\`\`\`

Open "/setup" to create the first administrator, then enter the Dashboard. The current UI can create and publish Posts and Pages, but it does not yet expose the complete workflow for creating and linking Translation Set variants.

## Verify the publishing loop

Create a Category, publish a Post and confirm it appears in the public list, FTS5 Search and JSON Feed for its Locale. Preview and Revision screens exercise the same saved Entry state without publishing drafts.`,
            "zh-Hans-CN": `# 快速开始

本教程会运行 Jamcaa 文档 Site。它是同时使用 Platform 与可选 Editor 包的参考实现。

## 准备条件

- Node.js 与 pnpm
- 仓库所需的本地 Cloudflare Binding 与 Secret
- 在 Windows 上执行 OpenNext 构建前启用 Windows 开发者模式

## 安装工作区

\`\`\`bash
pnpm install
\`\`\`

## 应用迁移

\`\`\`bash
pnpm --filter @jamcaaxian/docs db:migrate
pnpm --filter @jamcaaxian/docs db:docs:migrate
\`\`\`

## 启动 Site

\`\`\`bash
pnpm --filter @jamcaaxian/docs dev
\`\`\`

打开 "/setup" 创建首位管理员，再进入控制台。当前界面可以创建并发布 Post 与 Page，但尚未提供创建和关联 Translation Set 多语言版本的完整流程。

## 验证发布闭环

创建分类并发布一篇 Post，确认它出现在对应 Locale 的公开列表、FTS5 Search 与 JSON Feed 中。Preview 与 Revision 页面会在不发布草稿的情况下复用同一份已保存 Entry 状态。`
        }
    },
    {
        slug: "blocks",
        translationId: "product:blocks",
        title: { "en-US": "Composable Blocks", "zh-Hans-CN": "可组合 Blocks" },
        excerpt: {
            "en-US": "Declare typed Block Props, validation, text projection and Site-owned views.",
            "zh-Hans-CN": "声明类型化 Block Props、校验、文本投影与 Site 自有 View。"
        },
        markdown: {
            "en-US": `# Composable Blocks

Blocks let a Site compose Page bodies and Block Fields from declared units without turning stored content into unvalidated JSON.

## Declare the stored contract

Every Block owns a namespaced type, Prop declarations, validation and plain-text projection. Search consumes that projection instead of guessing which nested JSON values are public.

## Preserve unknown content

The Editor preserves unknown Blocks and lets authors add, move and remove installed definitions. A missing definition does not silently erase stored content.

## Render at the Site boundary

The optional Editor package provides built-in Blocks and a Block View Registry contract. The Site chooses which visual views to register; rendering is not derived from a Collection declaration.

## Keep the vocabulary deliberate

Start with a small vocabulary such as Rich Text, Feature, Callout, Statistic and Code. Add a custom Block only when it owns a durable content concept, validation rules and a meaningful public text projection.`,
            "zh-Hans-CN": `# 可组合 Blocks

Block 让 Site 以声明单元组合 Page 正文与 Block Field，同时避免把存储内容退化成未经校验的 JSON。

## 声明存储契约

每个 Block 拥有命名空间类型、Props 声明、校验与纯文本投影。Search 使用这份投影，而不是猜测嵌套 JSON 中哪些值可以公开。

## 保留未知内容

Editor 会保留未知 Block，并允许作者添加、移动和删除已安装定义。缺失定义不会静默擦除已存储内容。

## 在 Site 边界渲染

可选 Editor 包提供内置 Block 与 Block View Registry 契约。Site 决定注册哪些视觉 View；渲染不会从 Collection 声明中自动派生。

## 保持词汇克制

先使用 Rich Text、Feature、Callout、Statistic 与 Code 等少量词汇。只有当一个概念拥有持久内容含义、校验规则与明确公开文本投影时，才添加自定义 Block。`
        }
    },
    {
        slug: "localization",
        translationId: "product:localization",
        title: { "en-US": "Localization", "zh-Hans-CN": "本地化" },
        excerpt: {
            "en-US": "Partition authored variants by canonical Locale and link equivalents with a Translation Set.",
            "zh-Hans-CN": "按规范 Locale 分区内容版本，并用 Translation Set 关联对应版本。"
        },
        markdown: {
            "en-US": `# Localization

Jamcaa treats Locale as content identity, not interface copy layered over one row.

## One variant, one Entry

Every localized variant has its own slug, lifecycle, authoring state and public address. A stable Translation Set identifier links variants that represent the same concept.

Pages follow the same identity rule, but Pages and Entries remain different domain models and stores.

## Strict BCP 47

Sites register canonical language tags and stable lowercase URL keys. Jamcaa Docs maps \`en-US\` to \`en-us\` and \`zh-Hans-CN\` to \`zh-hans-cn\`.

## Partition every public surface

Summary cursors, search cursors, former addresses and feeds carry Locale. A cursor created for one language is rejected in another language.

## Keep the root neutral

The root address is a language chooser and \`x-default\`. Localized pages live under explicit prefixes so canonical and alternate links remain deterministic.

## Current authoring boundary

The data model and public reads understand Translation Sets. The current admin does not yet provide a complete UI for creating a variant, choosing its Locale and linking it to an existing Translation Set.`,
            "zh-Hans-CN": `# 本地化

Jamcaa 将 Locale 视为内容身份，而不是覆盖在同一行数据上的界面文案。

## 一个版本，一条 Entry

每个本地化版本都拥有自己的 Slug、生命周期、编辑状态和公开地址。稳定的 Translation Set 标识关联表达同一概念的多个版本。

Page 遵循同一身份规则，但 Page 与 Entry 仍属于不同的领域模型和 Store。

## 严格遵循 BCP 47

Site 注册规范语言标签与稳定的小写 URL Key。Jamcaa Docs 将 \`en-US\` 映射为 \`en-us\`，将 \`zh-Hans-CN\` 映射为 \`zh-hans-cn\`。

## 所有公开入口都按语言分区

摘要 Cursor、搜索 Cursor、Former Address 与 Feed 都携带 Locale。一个语言生成的 Cursor 会在另一个语言中被拒绝。

## 根地址保持中立

根地址作为语言选择页与 \`x-default\`。本地化页面使用显式前缀，使 Canonical 与 Alternate 链接始终确定。

## 当前编辑边界

数据模型与公开读取已经理解 Translation Set。当前管理端尚未提供创建版本、选择 Locale 并关联现有 Translation Set 的完整界面。`
        }
    },
    {
        slug: "api-reference",
        translationId: "product:api-reference",
        title: { "en-US": "API Reference", "zh-Hans-CN": "API 参考" },
        excerpt: {
            "en-US": "A current API map of the Stores, declarations and adapters used by the reference Site.",
            "zh-Hans-CN": "参考 Site 当前使用的 Store、声明与 Adapter 地图。"
        },
        markdown: {
            "en-US": `# API Reference

Jamcaa is pre-alpha. This page is a current API map, not a stability guarantee.

## Collection and Field declarations

Use \`defineCollection\` and installed Field Types to describe Entry shape, persistence, validation, Editing Controls, Summary projection, Revision encoding and Search expressions.

## Entry Store

Use \`entryStore\` to create, update and query typed Entries. Locale and Translation Set identity are immutable through ordinary updates.

## Summary Reader

Use \`entrySummaryReader\` for public lists. Keyset cursors retain query identity, including Locale, so pagination cannot leak across partitions.

## Search Adapter

Use \`d1SearchAdapter\` to project declared public text into FTS. Search results return Entry identifiers and excerpts; the Site then loads typed Entries.

## Block Registry

Use \`defineBlock\` and a Block Registry to declare Props, validation and plain-text ownership. Pair it with a Site-owned Block View Registry from the optional Editor package for rendering.

## Locale Catalogue

Use \`defineLocaleCatalogue\` to canonicalize supported tags, map stable URL keys and negotiate explicitly registered language ranges.

## Infrastructure adapters

Use the D1 Search adapter, Storage adapters and Counter Port where the reference Site needs those boundaries. D1 content tables and Cloudflare bindings remain explicit Site runtime integration.`,
            "zh-Hans-CN": `# API 参考

Jamcaa 仍处于 pre-alpha。本页是当前 API 地图，不代表稳定性承诺。

## Collection 与 Field 声明

使用 \`defineCollection\` 和已安装 Field Type 描述 Entry 结构、持久化、校验、Editing Control、Summary 投影、Revision 编解码与 Search 表达式。

## Entry Store

使用 \`entryStore\` 创建、更新与查询类型安全的 Entry。Locale 与 Translation Set 身份不能通过普通更新修改。

## Summary Reader

使用 \`entrySummaryReader\` 构建公开列表。Keyset Cursor 会保留包括 Locale 在内的查询身份，因此分页不会跨分区泄漏。

## Search Adapter

使用 \`d1SearchAdapter\` 将声明为公开的文本投影到 FTS。搜索返回 Entry 标识与摘要，Site 随后加载类型安全的 Entry。

## Block Registry

使用 \`defineBlock\` 与 Block Registry 声明 Props、校验和纯文本所有权，再配合可选 Editor 包中的 Site 自有 Block View Registry 完成渲染。

## Locale Catalogue

使用 \`defineLocaleCatalogue\` 规范支持的语言标签、映射稳定 URL Key，并协商显式注册的语言范围。

## 基础设施 Adapter

参考 Site 在需要的位置使用 D1 Search Adapter、Storage Adapter 与 Counter Port。D1 内容表和 Cloudflare Binding 仍是显式的 Site 运行时集成。`
        }
    },
    {
        slug: "reference",
        translationId: "product:reference",
        title: { "en-US": "Reference", "zh-Hans-CN": "参考" },
        excerpt: {
            "en-US": "Map implemented Platform contracts, optional Editor controls and Site-owned runtime boundaries.",
            "zh-Hans-CN": "梳理已实现的 Platform 契约、可选 Editor 控件与 Site 自有运行时边界。"
        },
        markdown: {
            "en-US": `# Reference

The reference section maps implemented contracts and the boundaries the reference Site owns today. Jamcaa remains pre-alpha, so this is not a stability promise.

## Content

Collections, Fields, Entries, Pages, Blocks, summaries and Translation Sets form the publishing model.

## Presentation

Block View registries and Site components own visual output. Core does not prescribe a product theme, route tree or page template.

## Infrastructure

D1 is the current content database. Search, Storage and Counters expose explicit boundaries; R2, Durable Objects, OpenNext and Cloudflare bindings are wired by the Site.

## Start with the API map

The API Reference lists the primary Store and registry entry points used by the documentation Site.`,
            "zh-Hans-CN": `# 参考

参考部分梳理当前已实现的契约，以及参考 Site 实际负责的边界。Jamcaa 仍处于 pre-alpha，因此这不是稳定性承诺。

## 内容

Collection、Field、Entry、Page、Block、摘要与 Translation Set 共同构成发布模型。

## 展示

Block View Registry 与 Site 组件负责视觉输出。Core 不规定产品主题、路由树或页面模板。

## 基础设施

D1 是当前内容数据库。Search、Storage 与 Counters 暴露明确边界；R2、Durable Object、OpenNext 与 Cloudflare Binding 由 Site 接线。

## 从 API 地图开始

API 参考列出文档 Site 使用的主要 Store 与 Registry 入口。`
        }
    },
    {
        slug: "changelog",
        translationId: "product:changelog",
        title: { "en-US": "Changelog", "zh-Hans-CN": "更新日志" },
        excerpt: {
            "en-US": "Recent implemented changes across Locale identity, Blocks, Search and the reference Site.",
            "zh-Hans-CN": "Locale 身份、Blocks、Search 与参考 Site 的近期已实现变更。"
        },
        markdown: {
            "en-US": `# Changelog

## Locale-partitioned publishing

Entries, Pages, summaries, search, former addresses and JSON Feeds now share one strict Locale identity model.

## Extensible Blocks

Built-in feature, statistic, callout, button and code Blocks now declare their own validation and search projection. Unknown Blocks remain intact during editing.

## Documentation Site

The public Site now uses explicit language routes, catalogue-driven language menus, Translation Set-aware alternate addresses and a responsive documentation shell. The admin UI, sign-in and setup flows resolve English or Simplified Chinese from URL, cookie and browser preference.

## Migration safety

The content identity migration and search rebuild are append-only. Historical search migration \`0014_search.sql\` remains unchanged.`,
            "zh-Hans-CN": `# 更新日志

## 按 Locale 分区的发布体系

Entry、Page、摘要、搜索、Former Address 与 JSON Feed 现在共享同一套严格 Locale 身份模型。

## 可扩展 Blocks

内置 Feature、Statistic、Callout、Button 与 Code Block 现在声明自身校验和搜索投影。编辑时未知 Block 会被完整保留。

## 文档 Site

公开 Site 现在采用显式语言路由、目录驱动的语言菜单、感知 Translation Set 的 Alternate 地址与响应式文档 Shell。管理端、登录与初始化流程会按 URL、Cookie 与浏览器偏好解析英文或简体中文。

## 安全迁移

内容身份迁移与搜索重建保持 Append-only。历史搜索迁移 \`0014_search.sql\` 未被修改。`
        }
    }
];

export function productPosts(): RepositoryPost[] {
    return productDocuments.flatMap(document =>
        docsLocales.definitions.map(({ tag: locale }) => ({
            slug: document.slug,
            locale,
            translationId: document.translationId,
            title: document.title[locale],
            excerpt: document.excerpt[locale],
            body: blockDocumentFromRichText(richTextFromMarkdown(document.markdown[locale]))
        }))
    );
}

export function productHomePages(): RepositoryPage[] {
    const homeCopy: Record<
        DocsLocale,
        {
            title: string;
            model: { eyebrow: string; title: string; description: string };
            blocks: { title: string; description: string };
            locale: { title: string; description: string };
            contracts: { label: string; detail: string };
            locales: { label: string };
            runtime: { label: string };
            proof: { title: string; body: string };
        }
    > = {
        "en-US": {
            title: "Jamcaa documentation",
            model: {
                eyebrow: "Collection declaration",
                title: "Derive the contracts that must agree",
                description:
                    "Collections and Fields drive D1 storage, validation, Editing Controls, summaries, Revisions and Search artifacts."
            },
            blocks: {
                title: "Compose bodies with declared Blocks",
                description: "Each Block owns Props, validation and public text; the Site owns its visual View."
            },
            locale: {
                title: "Keep Locale in content identity",
                description:
                    "Independent variants share a Translation Set while routes, Search, Former Addresses and Feed stay partitioned."
            },
            contracts: {
                label: "Collection declaration",
                detail: "Storage · validation · summaries · Revisions · Search"
            },
            locales: { label: "Locale variants published by this Site" },
            runtime: { label: "Cloudflare-first reference runtime" },
            proof: {
                title: "The reference Site runs the real paths",
                body: "This Site exercises Pages, Entry Summaries, Search, JSON Feed, Preview, Revisions and Media through Jamcaa's implemented contracts."
            }
        },
        "zh-Hans-CN": {
            title: "Jamcaa 文档",
            model: {
                eyebrow: "Collection 声明",
                title: "派生必须保持一致的发布契约",
                description: "Collection 与 Field 驱动 D1 存储、校验、Editing Control、摘要、Revision 与 Search 产物。"
            },
            blocks: {
                title: "使用声明式 Block 组合正文",
                description: "每个 Block 负责 Props、校验与公开文本；Site 负责视觉 View。"
            },
            locale: {
                title: "让 Locale 成为内容身份",
                description: "独立版本共享 Translation Set，同时路由、Search、Former Address 与 Feed 保持分区。"
            },
            contracts: { label: "份 Collection 声明", detail: "存储 · 校验 · 摘要 · Revision · Search" },
            locales: { label: "个由此 Site 发布的 Locale 版本" },
            runtime: { label: "Cloudflare-first 参考运行时" },
            proof: {
                title: "参考 Site 运行真实链路",
                body: "本站通过 Jamcaa 已实现的契约运行 Page、Entry Summary、Search、JSON Feed、Preview、Revision 与 Media。"
            }
        }
    };

    return docsLocales.definitions.map(({ tag: locale }) => {
        const copy = homeCopy[locale];
        const localeTags = docsLocales.definitions.map(definition => definition.tag).join(" · ");

        return {
            address: "/",
            locale,
            translationId: "product:home",
            title: copy.title,
            body: {
                version: 1 as const,
                blocks: [
                    {
                        id: `${locale}:feature:model`,
                        type: "builtin.feature",
                        props: {
                            eyebrow: copy.model.eyebrow,
                            title: copy.model.title,
                            description: copy.model.description,
                            href: localizedPath(locale, "/docs")
                        }
                    },
                    {
                        id: `${locale}:feature:blocks`,
                        type: "builtin.feature",
                        props: {
                            eyebrow: "Blocks",
                            title: copy.blocks.title,
                            description: copy.blocks.description,
                            href: localizedPath(locale, "/blocks")
                        }
                    },
                    {
                        id: `${locale}:feature:locale`,
                        type: "builtin.feature",
                        props: {
                            eyebrow: "BCP 47",
                            title: copy.locale.title,
                            description: copy.locale.description,
                            href: localizedPath(locale, "/localization")
                        }
                    },
                    {
                        id: `${locale}:stat:contracts`,
                        type: "builtin.stat",
                        props: { value: "1", label: copy.contracts.label, detail: copy.contracts.detail }
                    },
                    {
                        id: `${locale}:stat:locales`,
                        type: "builtin.stat",
                        props: {
                            value: String(docsLocales.definitions.length),
                            label: copy.locales.label,
                            detail: localeTags
                        }
                    },
                    {
                        id: `${locale}:stat:runtime`,
                        type: "builtin.stat",
                        props: {
                            value: "Edge",
                            label: copy.runtime.label,
                            detail: "Next.js · Workers · D1 · R2 · Durable Objects"
                        }
                    },
                    {
                        id: `${locale}:callout:dogfood`,
                        type: "builtin.callout",
                        props: { tone: "tip", title: copy.proof.title, body: copy.proof.body }
                    }
                ]
            }
        } satisfies RepositoryPage;
    });
}

export function docsSeedPosts(record: Record<string, string>): RepositoryPost[] {
    return [...productPosts(), ...repositoryPosts(record)];
}

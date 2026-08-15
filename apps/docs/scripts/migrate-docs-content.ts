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
        title: { "en-US": "Documentation overview", "zh-Hans-CN": "文档概览" },
        excerpt: {
            "en-US": "Learn what Jamcaa solves, what a Site still owns, and where to begin.",
            "zh-Hans-CN": "先了解 Jamcaa 解决什么、Site 仍负责什么，以及应该从哪里开始。"
        },
        markdown: {
            "en-US": `# Documentation overview

Jamcaa is a publishing Platform for content-driven Sites running on Cloudflare Workers. A Site describes its content in TypeScript; Jamcaa turns that declaration into the contracts required for editing, storage, validation, typed access, Revisions, and Search.

## When Jamcaa is a good fit

Jamcaa is designed for teams that want structured content on an edge runtime without maintaining the same model separately in database tables, forms, TypeScript types, and search indexes.

It is a strong fit when your Site needs custom routes and presentation, but still wants a reusable administration and publishing foundation.

## Begin with one Collection

A Collection describes one kind of Entry. Its Fields define what authors can enter and what the Platform must store and validate.

From that declaration, Jamcaa connects:

- D1 storage and schema checks;
- browser Editing Controls;
- typed Entry reads and writes;
- public Entry Summaries;
- append-only Revisions;
- declared full-text Search projections.

## Keep product decisions in the Site

Jamcaa does not generate your route tree or prescribe a page template. The Site still owns public routes, visual components, Block views, navigation, and product policy. The Platform owns the reusable contracts that must stay consistent underneath them.

## See the real workflow

This documentation Site is also the reference implementation. It runs Pages, Entries, Blocks, Taxonomy, Media, Preview, Revisions, FTS5 Search, JSON Feed, and Locale-partitioned public routes on Next.js and Cloudflare Workers.

## Choose your next step

- Use **Getting started** to run the reference Site locally.
- Read **Guides** to follow a task-oriented path through content modeling, Blocks, and Locales.
- Open **API Reference** when you need the concrete Stores, declarations, and adapters.

## Current status

Jamcaa is pre-alpha and Cloudflare-first. Public APIs may change before 1.0, and unfinished extension contracts are documented as current boundaries rather than promised features.`,
            "zh-Hans-CN": `# 文档概览

Jamcaa 是一个面向内容型 Site、运行在 Cloudflare Workers 上的发布 Platform。Site 用 TypeScript 描述自己的内容，Jamcaa 再把这份声明连接到编辑、存储、校验、类型安全访问、Revision 与 Search 所需的契约。

## 什么情况下适合使用 Jamcaa

如果你希望在边缘运行环境上管理结构化内容，又不想分别维护数据库表、后台表单、TypeScript 类型和搜索索引，Jamcaa 就适合解决这类重复同步问题。

它尤其适合需要自定义路由和视觉呈现，同时又希望复用管理与发布基础能力的 Site。

## 从一份 Collection 开始

Collection 描述一种 Entry，Field 描述作者可以填写什么，以及 Platform 必须怎样存储和校验这些内容。

Jamcaa 会从这份声明衔接：

- D1 存储与结构检查；
- 浏览器中的 Editing Control；
- 类型安全的 Entry 读写；
- 面向列表的 Entry Summary；
- Append-only Revision；
- 显式声明的全文 Search 投影。

## 把产品决定留在 Site

Jamcaa 不会替你生成路由树，也不规定页面模板。公开路由、视觉组件、Block View、导航和产品策略仍由 Site 负责；Platform 只负责底层那些必须保持一致、又值得复用的契约。

## 查看真实发布流程

这个文档 Site 同时也是参考实现。它在 Next.js 与 Cloudflare Workers 上实际运行 Page、Entry、Block、Taxonomy、Media、Preview、Revision、FTS5 Search、JSON Feed，以及按 Locale 分区的公开路由。

## 选择下一步

- 想先跑起来：阅读**快速开始**。
- 想按任务学习：进入**使用指南**，了解内容建模、Block 与多语言内容。
- 想查具体入口：打开 **API 参考**，定位 Store、声明和 Adapter。

## 当前状态

Jamcaa 仍处于 pre-alpha，并以 Cloudflare 为首要运行环境。1.0 之前公开 API 可能变化；尚未完成的扩展契约会被明确写成当前边界，而不会包装成已经可用的功能。`
        }
    },
    {
        slug: "guides",
        translationId: "product:guides",
        title: { "en-US": "Guides", "zh-Hans-CN": "使用指南" },
        excerpt: {
            "en-US": "Choose a path by task: run the Site, model content, compose Blocks, or publish Locales.",
            "zh-Hans-CN": "按任务选择阅读路径：运行 Site、建模内容、组合 Block 或发布多语言版本。"
        },
        markdown: {
            "en-US": `# Guides

Use this section by task rather than reading every page in order.

## I want to run Jamcaa locally

Start with **Getting started**. You will install the workspace, prepare local bindings, apply D1 migrations, start Next.js, and create the first administrator.

## I want to define content

Begin with a small Collection and only the Fields the Site actually needs. The declaration becomes the shared source for storage, validation, Editing Controls, typed access, summaries, Revisions, and Search.

The reference Site's Post Collection is the best concrete example to inspect while reading.

## I want to compose Pages or Entry bodies

Read **Composable Blocks** before creating a Site-specific vocabulary. Use Rich Text for ordinary long-form writing. Add a custom Block when a durable concept needs its own Props, validation, search projection, or presentation behavior.

## I want to publish more than one language

Read **Localization** before importing content variants. In Jamcaa, Locale is part of content identity rather than a set of translated Fields on one row. That choice affects addresses, publication state, Search, pagination, feeds, and Former Addresses.

## I need concrete APIs

Use **API Reference** as a map of the declarations, Stores, registries, and adapters exercised by this Site. The broader **Reference** section explains how those pieces fit together.

## I am preparing a deployment

The reference Site uses OpenNext on Cloudflare Workers, D1, R2, and a Durable Object counters Worker. Prove the application build before advancing a remote schema, then deploy and apply the documentation seed with the reviewed artifact. Use Linux or WSL for production OpenNext builds.`,
            "zh-Hans-CN": `# 使用指南

这一部分适合按任务阅读，不必从头到尾逐篇看完。

## 我想先在本地跑起来

从**快速开始**进入。你会安装 Workspace、准备本地 Binding、应用 D1 迁移、启动 Next.js，并创建首位管理员。

## 我想定义自己的内容

先声明一个足够小的 Collection，只加入 Site 真正需要的 Field。这份声明会成为存储、校验、Editing Control、类型安全访问、摘要、Revision 与 Search 的共同来源。

阅读时可以同步查看参考 Site 的 Post Collection，它是最完整的可运行示例。

## 我想组合 Page 或 Entry 正文

创建 Site 专属词汇前，先阅读**可组合 Blocks**。普通长文优先使用 Rich Text；当一个持久概念需要独立 Props、校验、搜索投影或呈现行为时，再增加自定义 Block。

## 我想发布多语言内容

导入内容版本前先阅读**本地化**。Jamcaa 把 Locale 作为内容身份的一部分，而不是把翻译后的 Field 都塞进同一行。这个选择会影响地址、发布状态、Search、分页、Feed 与 Former Address。

## 我需要查具体 API

通过 **API 参考**定位这个 Site 实际使用的声明、Store、Registry 与 Adapter；再用更上层的**参考**章节理解它们如何协作。

## 我准备部署到生产环境

参考 Site 通过 OpenNext 运行在 Cloudflare Workers 上，并使用 D1、R2 与 Durable Object 计数 Worker。先证明应用能够构建，再推进远程 Schema；随后部署已验证的产物并应用文档 Seed。生产 OpenNext 构建请使用 Linux 或 WSL。`
        }
    },
    {
        slug: "getting-started",
        translationId: "product:getting-started",
        title: { "en-US": "Getting started", "zh-Hans-CN": "快速开始" },
        excerpt: {
            "en-US": "Run the reference Site locally and verify one complete publishing loop.",
            "zh-Hans-CN": "在本地运行参考 Site，并验证一条完整的内容发布闭环。"
        },
        markdown: {
            "en-US": `# Getting started

This guide runs the Jamcaa documentation Site. It is the reference implementation where the Platform, the optional Editor package, and the Cloudflare runtime are exercised together.

## What you will verify

By the end, you will be able to sign in, create content, publish it, and find the published result through the public Site and Search.

## Prerequisites

- Node.js 20.9 or newer;
- pnpm 10;
- the repository checked out locally;
- local Cloudflare bindings and secrets prepared from the example environment file.

Windows Developer Mode is only required when you attempt an OpenNext build on Windows. Ordinary local development does not need it.

## Prepare local configuration

Copy the example environment file to ".dev.vars", then provide the local secrets and R2 credentials described in the Site README.

## Install the workspace

From the repository root:

\`\`\`bash
pnpm install
\`\`\`

## Apply local migrations and seed the docs

\`\`\`bash
pnpm --filter @jamcaaxian/docs db:migrate
pnpm --filter @jamcaaxian/docs db:docs:migrate
\`\`\`

The first command applies the Site schema. The second writes the bilingual product documentation and repository documents into local D1.

## Start the Site

\`\`\`bash
pnpm --filter @jamcaaxian/docs dev
\`\`\`

Open "http://localhost:2727/setup" to create the first administrator. After setup, sign in to the Console.

## Verify the publishing loop

1. Create or choose a Category.
2. Create a Post, add its content, and publish it.
3. Confirm it appears in the public list for its Locale.
4. Search for text from the Post.
5. Open Preview and Revisions to confirm saved states stay separate from publication.

The current Console can create and publish Posts and Pages. It does not yet expose the complete workflow for creating a Locale variant and linking it to an existing Translation Set.`,
            "zh-Hans-CN": `# 快速开始

本教程会运行 Jamcaa 文档 Site。它是同时验证 Platform、可选 Editor 包与 Cloudflare 运行时的参考实现。

## 你将完成什么

完成后，你可以登录控制台、创建内容、发布内容，并在公开 Site 与 Search 中找到刚刚发布的结果。

## 准备条件

- Node.js 20.9 或更高版本；
- pnpm 10；
- 已在本地检出仓库；
- 已根据环境变量示例准备本地 Cloudflare Binding 与 Secret。

只有在 Windows 上尝试 OpenNext 构建时才需要启用 Windows 开发者模式；普通本地开发不需要。

## 准备本地配置

把环境变量示例复制为 ".dev.vars"，再根据 Site README 填入本地 Secret 与 R2 凭据。

## 安装 Workspace

在仓库根目录运行：

\`\`\`bash
pnpm install
\`\`\`

## 应用本地迁移并写入文档 Seed

\`\`\`bash
pnpm --filter @jamcaaxian/docs db:migrate
pnpm --filter @jamcaaxian/docs db:docs:migrate
\`\`\`

第一条命令应用 Site Schema，第二条命令把双语产品文档与仓库文档写入本地 D1。

## 启动 Site

\`\`\`bash
pnpm --filter @jamcaaxian/docs dev
\`\`\`

打开 "http://localhost:2727/setup" 创建首位管理员，完成后登录控制台。

## 验证发布闭环

1. 创建或选择一个 Category。
2. 创建一篇 Post，填写内容并发布。
3. 确认它出现在对应 Locale 的公开列表中。
4. 搜索刚刚写入 Post 的文字。
5. 打开 Preview 与 Revision，确认已保存状态与公开发布互不混淆。

当前控制台可以创建并发布 Post 与 Page，但还没有提供创建 Locale 版本并关联现有 Translation Set 的完整操作流程。`
        }
    },
    {
        slug: "blocks",
        translationId: "product:blocks",
        title: { "en-US": "Composable Blocks", "zh-Hans-CN": "可组合 Block" },
        excerpt: {
            "en-US":
                "Use declared Blocks to compose bodies without giving up validation, Search, or Site-owned rendering.",
            "zh-Hans-CN": "用声明式 Block 组合正文，同时保留校验、Search 与 Site 自有渲染。"
        },
        markdown: {
            "en-US": `# Composable Blocks

Blocks let authors assemble a body from declared units without turning stored content into unvalidated JSON. Rich Text is one Block among others, so a Site can mix long-form writing with durable product concepts.

## Start with Rich Text

Use Rich Text for ordinary headings, paragraphs, lists, links, and code. Add another Block only when a concept needs its own editing surface, validation, Search projection, or presentation behavior.

Good examples include a feature card, callout, statistic, code sample, or a Site configuration instruction.

## Declare what can be stored

Each Block owns a namespaced type and a Prop declaration. Validation fills declared defaults and rejects undeclared or invalid values before content is stored.

\`\`\`ts
const docsSidebar = defineBlock({
    name: "docs.sidebar",
    label: "Documentation sidebar",
    props: {
        multiLevel: { kind: "flag", label: "Multi-level menu", default: true },
        autoCollapse: { kind: "flag", label: "Automatically collapse other sections", default: true }
    }
});
\`\`\`

## Separate configuration from visible content

The documentation Site uses \`docs.sidebar\` as a Site-owned configuration Block. An author can add it to one document and decide whether that page uses a multi-level menu and whether opening one section closes its siblings.

The Site removes this Block before rendering the body. Because the definition declares no plain-text projection, it does not enter full-text Search either.

## Render at the Site boundary

The optional Editor package supplies built-in Blocks and the Block View Registry contract. The Site registers the visual views it wants. A Collection declaration never decides a product's HTML or styling.

## Preserve content when a definition is missing

The Editor keeps unknown Blocks intact and reports the missing definition instead of silently deleting stored content. This makes plugin or Site changes recoverable.

## Keep the vocabulary small

Before adding a Block, ask whether it owns a durable concept, meaningful validation, and a clear public-text policy. If not, Rich Text is usually the better choice.`,
            "zh-Hans-CN": `# 可组合 Blocks

Block 让作者用声明单元组合正文，同时避免把存储内容退化成未经校验的 JSON。Rich Text 只是其中一种 Block，因此 Site 可以把长文与稳定的产品概念放在同一份正文里。

## 优先从 Rich Text 开始

普通标题、段落、列表、链接和代码优先使用 Rich Text。只有当一个概念需要独立的编辑界面、校验、Search 投影或呈现行为时，再增加新的 Block。

功能卡片、提示、统计数字、代码示例或 Site 配置指令，都是更适合独立 Block 的例子。

## 声明允许存储什么

每个 Block 都拥有带命名空间的类型和 Props 声明。内容写入前，校验会补全默认值，并拒绝未声明或类型错误的值。

\`\`\`ts
const docsSidebar = defineBlock({
    name: "docs.sidebar",
    label: "文档侧栏",
    props: {
        multiLevel: { kind: "flag", label: "启用多级菜单", default: true },
        autoCollapse: { kind: "flag", label: "自动收起其他目录", default: true }
    }
});
\`\`\`

## 把配置与可见正文分开

文档 Site 使用 \`docs.sidebar\` 作为 Site 自有配置 Block。作者可以只在某一篇文档中加入它，并决定该页面是否启用多级菜单，以及展开一个目录时是否自动收起同级目录。

Site 会在渲染正文前移除这个 Block。它也没有声明纯文本投影，因此不会进入全文 Search。

## 在 Site 边界完成渲染

可选 Editor 包提供内置 Block 与 Block View Registry 契约，Site 决定注册哪些视觉 View。Collection 声明不会替产品决定 HTML 或样式。

## 定义缺失时仍保留内容

Editor 会完整保留未知 Block，并报告缺失的定义，而不是静默删除已经存储的内容。这样即使插件或 Site 配置发生变化，内容仍有恢复空间。

## 保持 Block 词汇克制

增加 Block 前先确认：它是否代表持久概念，是否拥有有意义的校验，以及是否有清楚的公开文本策略。如果都没有，Rich Text 通常更合适。`
        }
    },
    {
        slug: "localization",
        translationId: "product:localization",
        title: { "en-US": "Localization", "zh-Hans-CN": "本地化与 Locale" },
        excerpt: {
            "en-US": "Publish independent Locale variants and link equivalents with a stable Translation Set.",
            "zh-Hans-CN": "把每种语言作为独立内容版本发布，再用稳定的 Translation Set 关联对应版本。"
        },
        markdown: {
            "en-US": `# Localization

Jamcaa treats Locale as part of content identity, not as translated Fields layered over one database row.

## Publish one independent variant per Locale

Each Locale variant is its own Entry or Page. It has an independent slug or address, draft and publication state, authoring history, and public body.

This lets the English version remain a draft while the Simplified Chinese version is published, or lets two variants use different addresses without adding nullable translated columns to every Field.

## Link equivalent variants with a Translation Set

A stable Translation Set identifier links variants that represent the same concept. It does not merge their lifecycle or content.

One Translation Set may contain at most one Entry or Page for each registered Locale.

## Register canonical tags and stable URL keys

Sites register a finite Locale catalogue. Jamcaa Docs uses canonical BCP 47 tags internally and stable lowercase URL keys publicly: \`en-US\` maps to \`en-us\`, and \`zh-Hans-CN\` maps to \`zh-hans-cn\`.

Menus present human-readable language names; raw tags remain available where authors or integrations need the exact identity.

## Keep every public read in its Locale

Entry Summaries, Search cursors, Former Addresses, feeds, canonical links, and alternate links all carry Locale. A cursor created for one Locale is rejected in another, so pagination and Search cannot cross language boundaries accidentally.

## Keep the root neutral

The root address is a language chooser and the \`x-default\` alternate. Localized content always uses an explicit prefix, making canonical and alternate addresses deterministic.

## Current authoring workflow

The data model, seed pipeline, and public reads understand Locale variants and Translation Sets. The current Console does not yet provide the complete workflow for creating a new variant, choosing its Locale, and linking it to an existing Translation Set.`,
            "zh-Hans-CN": `# 本地化与 Locale

Jamcaa 把 Locale 视为内容身份的一部分，而不是覆盖在同一条数据库记录上的翻译 Field。

## 每个 Locale 发布一个独立版本

每个 Locale 版本都是独立的 Entry 或 Page，拥有自己的 Slug 或地址、草稿与发布状态、编辑历史和公开正文。

因此，简体中文版可以已经发布，而英文版仍保持草稿；两个版本也可以使用不同地址，而不必为每个 Field 增加一组可空翻译列。

## 用 Translation Set 关联对应版本

稳定的 Translation Set 标识用于关联表达同一概念的版本，但不会合并它们的生命周期或正文。

一个 Translation Set 在每个已注册 Locale 下最多只能有一个 Entry 或 Page。

## 注册规范 Tag 与稳定 URL Key

Site 会注册有限的 Locale 目录。Jamcaa Docs 在内部使用规范 BCP 47 Tag，在公开 URL 中使用稳定的小写 Key：\`en-US\` 对应 \`en-us\`，\`zh-Hans-CN\` 对应 \`zh-hans-cn\`。

语言菜单只展示人类可读名称；只有作者或集成需要精确身份时，才使用原始 Tag。

## 让所有公开读取保持语言分区

Entry Summary、Search Cursor、Former Address、Feed、Canonical 与 Alternate 链接都会携带 Locale。一个 Locale 创建的 Cursor 会在另一个 Locale 中被拒绝，避免分页或 Search 意外跨越语言边界。

## 让根地址保持中立

根地址是语言选择页，同时作为 \`x-default\` Alternate。本地化内容始终使用显式前缀，因此 Canonical 与 Alternate 地址可以保持确定。

## 当前编辑流程

数据模型、Seed 流程与公开读取已经理解 Locale 版本和 Translation Set；当前控制台还没有提供创建新版本、选择 Locale 并关联现有 Translation Set 的完整操作流程。`
        }
    },
    {
        slug: "api-reference",
        translationId: "product:api-reference",
        title: { "en-US": "API Reference", "zh-Hans-CN": "API 参考" },
        excerpt: {
            "en-US": "Find the declarations, Stores, registries, and adapters used by the reference Site.",
            "zh-Hans-CN": "定位参考 Site 实际使用的声明、Store、Registry 与 Adapter。"
        },
        markdown: {
            "en-US": `# API Reference

This page is a practical map of the main APIs used by the documentation Site. Jamcaa is pre-alpha, so names and signatures may change before 1.0.

## Declare content with defineCollection

Use \`defineCollection\` with installed Field Types to describe one kind of Entry. The declaration names its Fields, title Field, summary projection, and public Search projection.

The resulting Collection carries the static Field information used by typed Entry APIs.

## Read and write Entries with entryStore

Use \`entryStore\` for typed create, update, remove, identity, translation, and list operations. Do not query a Collection's assembled Drizzle table directly when you want the declaration-derived Entry type.

Locale and Translation Set identity are fixed through ordinary updates.

## Build public lists with entrySummaryReader

Use \`entrySummaryReader\` to read published-only Entry Summaries without loading long-form content. Keyset cursors retain the query identity, including Locale and filters, so pagination cannot cross partitions.

## Search declared public text with d1SearchAdapter

Use \`d1SearchAdapter\` to query the FTS artifact generated from declared searchable Fields. Results contain Entry identifiers and match excerpts; the Site loads the matching typed Entries separately.

## Declare composable bodies with defineBlock

Use \`defineBlock\` and a Block Registry to declare Props, validation, defaults, and optional plain-text projection. Pair the stored registry with a Site-owned Block View Registry from \`@jamcaaxian/editor\` when the Block has visible output.

Use \`parseBlockDocument\` at write boundaries and \`blockPlainText\` when a Site-owned pipeline needs the same declared Search projection.

## Register supported Locales

Use \`defineLocaleCatalogue\` to canonicalize supported BCP 47 tags, map stable public URL keys, and negotiate only the language ranges the Site explicitly registered.

## Keep runtime dependencies behind explicit boundaries

Use the D1 Search adapter, Storage adapters, and Counter Port at their runtime boundaries. The Site remains responsible for assembling its content model, binding Cloudflare resources, and choosing concrete public routes.`,
            "zh-Hans-CN": `# API 参考

本页按参考 Site 的真实使用路径整理主要 API。Jamcaa 仍处于 pre-alpha，因此名称和签名在 1.0 之前可能变化。

## 用 defineCollection 声明内容

使用 \`defineCollection\` 与已安装的 Field Type 描述一种 Entry，包括它的 Field、标题 Field、摘要投影与公开 Search 投影。

生成的 Collection 会携带静态 Field 信息，供类型安全的 Entry API 使用。

## 用 entryStore 读写 Entry

使用 \`entryStore\` 完成类型安全的创建、更新、删除、按身份查询、翻译版本查询与列表读取。如果需要保留声明派生出的 Entry 类型，不要直接查询 Collection 组装出的 Drizzle Table。

Locale 与 Translation Set 身份不能通过普通更新修改。

## 用 entrySummaryReader 构建公开列表

使用 \`entrySummaryReader\` 读取只包含已发布内容的 Entry Summary，而不加载长正文。Keyset Cursor 会保留包括 Locale 与筛选条件在内的查询身份，因此分页不会跨分区。

## 用 d1SearchAdapter 搜索公开文本

使用 \`d1SearchAdapter\` 查询由可搜索 Field 声明生成的 FTS 产物。结果包含 Entry 标识与命中摘要，Site 再单独加载对应的类型安全 Entry。

## 用 defineBlock 声明可组合正文

使用 \`defineBlock\` 与 Block Registry 声明 Props、校验、默认值与可选纯文本投影；如果 Block 需要可见输出，再配合 \`@jamcaaxian/editor\` 中由 Site 持有的 Block View Registry。

在写入边界使用 \`parseBlockDocument\`，在 Site 自有流程需要复用声明式 Search 投影时使用 \`blockPlainText\`。

## 注册 Site 支持的 Locale

使用 \`defineLocaleCatalogue\` 规范支持的 BCP 47 Tag、映射稳定公开 URL Key，并且只协商 Site 显式注册的语言范围。

## 让运行时依赖保持显式边界

在对应运行时边界使用 D1 Search Adapter、Storage Adapter 与 Counter Port。Site 仍负责组装自己的 Content Model、绑定 Cloudflare 资源，并决定具体公开路由。`
        }
    },
    {
        slug: "reference",
        translationId: "product:reference",
        title: { "en-US": "Platform reference", "zh-Hans-CN": "Platform 参考" },
        excerpt: {
            "en-US": "Understand the Platform contracts, optional Editor package, and Site-owned boundaries.",
            "zh-Hans-CN": "理解 Platform 契约、可选 Editor 包与 Site 自有边界。"
        },
        markdown: {
            "en-US": `# Platform reference

Use this section when you need the shape of the system rather than a step-by-step guide. It describes implemented boundaries, not a stability promise.

## Content model

Collections and Fields describe Entry structure. Entries carry authored content, lifecycle, Taxonomy, Locale identity, and Revisions. Entry Summaries support public lists and feeds without loading long-form bodies.

Pages are addressable Block documents outside Collections and Taxonomy. Translation Sets link equivalent Locale variants while each Entry or Page keeps an independent lifecycle.

## Authoring and presentation

The Worker-safe core owns declarations, validation, persistence contracts, and domain operations. The optional Editor package maps declared Fields and Blocks to browser authoring controls.

Block View registries and Site components own visible output. Core does not prescribe a theme, route tree, navigation model, or page template.

## Authorization

Capabilities form the permission vocabulary, while Role grants live in the database. Console access is an explicit capability, so public navigation and the admin route use the same authorization source rather than checking Role names.

## Runtime and infrastructure

D1 is the current content database. Search, Storage, and Counters expose explicit boundaries; R2, Durable Objects, OpenNext, and Cloudflare bindings are wired by the Site.

## Where to continue

Open **API Reference** for concrete declarations, Stores, and adapters. Read the architectural records in the repository when you need the trade-offs behind a boundary.`,
            "zh-Hans-CN": `# Platform 参考

当你需要理解整体结构，而不是按步骤操作时，可以从这一部分进入。这里描述当前已经实现的边界，不代表稳定性承诺。

## 内容模型

Collection 与 Field 描述 Entry 结构；Entry 承载已创作内容、生命周期、Taxonomy、Locale 身份与 Revision；Entry Summary 用于公开列表和 Feed，无需加载长正文。

Page 是位于 Collection 与 Taxonomy 之外、拥有公开地址的 Block 文档。Translation Set 关联对应 Locale 版本，但每个 Entry 或 Page 仍保留独立生命周期。

## 编辑与呈现

Worker-safe Core 负责声明、校验、持久化契约与领域操作；可选 Editor 包把已声明的 Field 与 Block 映射为浏览器 Editing Control。

Block View Registry 与 Site 组件负责可见输出。Core 不规定主题、路由树、导航模型或页面模板。

## 授权

Capability 构成授权词汇，Role Grant 存放在数据库中。Console 访问也是一项显式 Capability，因此公开导航与后台路由可以使用同一授权来源，而不是检查 Role 名称。

## 运行时与基础设施

D1 是当前内容数据库。Search、Storage 与 Counter 暴露显式边界；R2、Durable Object、OpenNext 与 Cloudflare Binding 由 Site 接线。

## 继续阅读

需要具体声明、Store 与 Adapter 时打开 **API 参考**；需要理解某个边界背后的取舍时，阅读仓库中的架构决策记录。`
        }
    },
    {
        slug: "changelog",
        translationId: "product:changelog",
        title: { "en-US": "Changelog", "zh-Hans-CN": "更新日志" },
        excerpt: {
            "en-US": "Recent changes to the documentation experience, authorization, Locale identity, and Blocks.",
            "zh-Hans-CN": "文档体验、授权、Locale 身份与 Block 的近期变更。"
        },
        markdown: {
            "en-US": `# Changelog

## Documentation navigation

Documentation pages now show an active-page indicator and support collapsible sections. A Site-owned \`docs.sidebar\` Block lets an author choose whether one document uses a multi-level menu and whether sibling sections collapse automatically.

## Authorization-aware public UI

The Console button and edit links now appear only when the current user holds the required capabilities. The admin route also requires explicit \`console:access\`; public UI no longer infers access from a Role name.

## Language menus and copy

Language menus now show human-readable names without exposing raw Locale tags. Public copy and product documentation were rewritten Chinese-first, with English localized from the revised information architecture.

## Locale-partitioned publishing

Entries, Pages, summaries, search, former addresses and JSON Feeds now share one strict Locale identity model.

## Extensible Blocks

Built-in feature, statistic, callout, button and code Blocks now declare their own validation and search projection. Unknown Blocks remain intact during editing.

## Documentation Site

The public Site uses explicit language routes, Translation Set-aware alternate addresses and a responsive documentation shell. The Console, sign-in and setup flows resolve English or Simplified Chinese from URL, cookie and browser preference.

## Migration safety

The content identity migration and search rebuild are append-only. Historical search migration \`0014_search.sql\` remains unchanged.`,
            "zh-Hans-CN": `# 更新日志

## 文档导航

文档页面现在会标记当前页面，并支持收起子目录。作者可以在单篇文档中加入 Site 自有的 \`docs.sidebar\` Block，决定是否使用多级菜单，以及展开一个目录时是否自动收起同级目录。

## 感知授权的公开界面

只有当前用户拥有对应 Capability 时，公开页面才显示控制台按钮和编辑入口。后台路由也会显式检查 \`console:access\`，不再通过 Role 名称推断访问资格。

## 语言菜单与文案

语言菜单现在只显示人类可读名称，不再展示原始 Locale Tag。公开文案与产品文档按中文优先重写，英文基于新的中文信息架构完成本地化。

## 按 Locale 分区的发布体系

Entry、Page、摘要、搜索、Former Address 与 JSON Feed 现在共享同一套严格 Locale 身份模型。

## 可扩展 Blocks

内置 Feature、Statistic、Callout、Button 与 Code Block 现在声明自身校验和搜索投影。编辑时未知 Block 会被完整保留。

## 文档 Site

公开 Site 采用显式语言路由、感知 Translation Set 的 Alternate 地址与响应式文档 Shell。控制台、登录与初始化流程会按 URL、Cookie 与浏览器偏好解析英文或简体中文。

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
            body: {
                version: 1,
                blocks: [
                    {
                        id: `${locale}:${document.slug}:sidebar`,
                        type: "docs.sidebar",
                        props: { multiLevel: true, autoCollapse: true }
                    },
                    ...blockDocumentFromRichText(richTextFromMarkdown(document.markdown[locale])).blocks
                ]
            }
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
                eyebrow: "Declare content once",
                title: "Keep storage, editing, types, and Search aligned",
                description:
                    "A Collection declaration becomes the shared source for D1 storage, validation, Editing Controls, typed access, summaries, Revisions, and Search."
            },
            blocks: {
                title: "Build flexible bodies without unvalidated JSON",
                description:
                    "Rich Text and custom Blocks share one validated document; the Site decides how every visible Block renders."
            },
            locale: {
                title: "Publish each language on its own terms",
                description:
                    "Each Locale variant has its own lifecycle and address, while a Translation Set links versions of the same concept."
            },
            contracts: {
                label: "declaration to maintain",
                detail: "Storage · validation · editing · types · Revisions · Search"
            },
            locales: { label: "languages maintained as independent variants" },
            runtime: { label: "reference runtime built for Cloudflare" },
            proof: {
                title: "You are reading the reference Site",
                body: "These Pages, lists, Search results, language variants, previews, Revisions, and Media paths all run through Jamcaa's implemented contracts."
            }
        },
        "zh-Hans-CN": {
            title: "Jamcaa 文档",
            model: {
                eyebrow: "内容只声明一次",
                title: "让存储、编辑、类型与 Search 始终一致",
                description:
                    "一份 Collection 声明成为 D1 存储、校验、Editing Control、类型安全访问、摘要、Revision 与 Search 的共同来源。"
            },
            blocks: {
                title: "组合灵活正文，同时拒绝未经校验的 JSON",
                description: "Rich Text 与自定义 Block 共用一份经过校验的文档，所有可见 Block 仍由 Site 决定怎样渲染。"
            },
            locale: {
                title: "让每种语言独立发布",
                description: "每个 Locale 版本拥有自己的生命周期和地址，再通过 Translation Set 关联同一概念。"
            },
            contracts: { label: "份需要维护的声明", detail: "存储 · 校验 · 编辑 · 类型 · Revision · Search" },
            locales: { label: "种作为独立版本维护的语言" },
            runtime: { label: "面向 Cloudflare 的参考运行时" },
            proof: {
                title: "你正在阅读的就是参考 Site",
                body: "这些 Page、列表、Search 结果、语言版本、Preview、Revision 与 Media 链路都在使用 Jamcaa 已实现的契约。"
            }
        }
    };

    return docsLocales.definitions.map(({ tag: locale }) => {
        const copy = homeCopy[locale];
        const localeLabels = docsLocales.definitions.map(definition => definition.label).join(" · ");

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
                            detail: localeLabels
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

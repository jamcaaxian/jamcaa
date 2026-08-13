import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@jamcaaxian/core/db";
import {
    blocksToRichText,
    entryStore,
    entrySummaryReader,
    richTextToPlainText,
    taxonomyStore
} from "@jamcaaxian/core/content";
import { d1SearchAdapter } from "@jamcaaxian/core/search";
import { post } from "@/content/collections";
import { contentModel, postTable } from "@/content/schema";
import { jsonFeed } from "@/content/feed";
import { docSourcesFromRecord, migrateDocsContent } from "../scripts/migrate-docs-content";

function database(): Database {
    return createDatabase(env.DB);
}

interface DocsContext {
    authorId: string;
    categoryId: string;
}

async function ensurePrerequisites(): Promise<DocsContext> {
    const db = database();

    await db.$client
        .prepare(
            "INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1)"
        )
        .bind("docs-author", "Documentation", "docs@jamcaa.local")
        .run();

    const taxonomy = taxonomyStore(db);
    const existing = await taxonomy.categoryBySlug("documentation");
    const category = existing ?? (await taxonomy.createCategory({ name: "Documentation", slug: "documentation" }));

    return { authorId: "docs-author", categoryId: category.id };
}

async function migrate(sources: ReturnType<typeof docSourcesFromRecord>, context: DocsContext) {
    return await migrateDocsContent({
        database: database(),
        collection: post,
        table: postTable,
        authorId: context.authorId,
        categoryId: context.categoryId,
        sources
    });
}

describe("repository docs migration", () => {
    let sourceCount = 0;
    let firstResult: Awaited<ReturnType<typeof migrate>> | undefined;

    beforeAll(async () => {
        const sources = docSourcesFromRecord(env.TEST_DOCS);
        sourceCount = sources.length;
        firstResult = await migrate(sources, await ensurePrerequisites());
    });

    it("migrates every repository document once and idempotently", async () => {
        expect(sourceCount).toBeGreaterThan(25);
        expect(firstResult).toEqual({ created: sourceCount, updated: 0 });

        const second = await migrate(docSourcesFromRecord(env.TEST_DOCS), await ensurePrerequisites());

        expect(second).toEqual({ created: 0, updated: sourceCount });

        const store = entryStore({ database: database(), collection: post, table: postTable });
        const published = await store.list({ status: "published", limit: 100 });

        expect(published.length).toBe(sourceCount);
    }, 30_000);

    it("publishes readable Rich Text under stable slugs", async () => {
        const store = entryStore({ database: database(), collection: post, table: postTable });
        const context = await store.bySlug("context");

        expect(context?.title).toBe("jamcaa");
        expect(richTextToPlainText(blocksToRichText(context!.body))).toContain("publishing platform");

        const adr = await store.bySlug("adr-0013-docs-site-dogfoods-the-framework");

        expect(adr?.title).toBe("The documentation site is built with the framework and doubles as the example");
        expect(richTextToPlainText(blocksToRichText(adr!.body))).toContain("bootstrapping");

        expect(await store.bySlug("agents-triage-labels")).toBeDefined();
    }, 30_000);

    it("shows migrated entries in summaries, search, and feed", async () => {
        const store = entryStore({ database: database(), collection: post, table: postTable });
        const reader = entrySummaryReader({ database: database(), model: contentModel, collection: post });
        const page = await reader.list({ limit: 50 });

        expect(page.summaries).toHaveLength(sourceCount);
        expect(page.summaries.map(summary => summary.title)).toContain("jamcaa");

        const adapter = d1SearchAdapter({
            database: database(),
            tableFor: name => contentModel.table(name),
            tagTableFor: name => contentModel.tagTable(name)
        });
        const results = await adapter.search({ collection: post, query: "publishing platform", limit: 10 });
        const matched = await store.byIds(results.matches.map(match => match.entryId));

        expect(matched.map(entry => entry.title)).toContain("jamcaa");

        const feed = jsonFeed({
            origin: "https://docs.example",
            title: "jamcaa docs",
            description: "The documentation",
            permalink: "/{slug}",
            summaries: page.summaries
        });

        expect(feed.items.map(item => item.title)).toContain("jamcaa");
        expect(feed.items).toHaveLength(sourceCount);
    }, 30_000);
});

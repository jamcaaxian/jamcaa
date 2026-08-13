import { createDatabase } from "@jamcaaxian/core";
import { createAuth } from "@jamcaaxian/core/auth";
import { richTextFromPlainText } from "@jamcaaxian/core/content";
import { d1SearchAdapter } from "@jamcaaxian/core/search";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { post } from "@/content/collections";
import { postTable, postTagTable } from "@/content/schema";
import { searchPosts } from "@/content/search";
import { posts, replacePostTags } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

const categoryId = "jamcaa-default-category";

function database() {
    return createDatabase(env.DB);
}

function search() {
    return d1SearchAdapter({
        database: database(),
        tableFor: collectionName => (collectionName === post.name ? postTable : undefined),
        tagTableFor: collectionName => (collectionName === post.name ? postTagTable : undefined)
    });
}

async function anAuthor() {
    const auth = createAuth({ database: database(), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
    const { user } = await auth.api.signUpEmail({
        body: { name: "Search Author", email: "search@example.com", password: "correct-horse-battery-staple" }
    });

    return user.id;
}

describe("published Entry search", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM _jamcaa_post_tag");
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM tag");
        await env.DB.exec("DELETE FROM category WHERE id <> 'jamcaa-default-category'");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("indexes only Published Entries and follows publication changes", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const draft = await store.create({
            slug: "draft",
            authorId,
            categoryId,
            title: "Edge runtime draft",
            body: richTextFromPlainText("Cloudflare D1")
        });

        expect((await search().search({ collection: post, query: "edge runtime" })).matches).toEqual([]);

        await store.update(draft.id, { status: "published" });

        expect((await search().search({ collection: post, query: "edge runtime" })).matches).toEqual([
            expect.objectContaining({ entryId: draft.id })
        ]);

        await store.update(draft.id, { status: "archived" });

        expect((await search().search({ collection: post, query: "edge runtime" })).matches).toEqual([]);
    });

    it("projects Rich Text and Media alternative text", async () => {
        const authorId = await anAuthor();
        const created = await posts(database()).create({
            slug: "rich-text",
            authorId,
            categoryId,
            title: "Projection",
            body: {
                type: "doc",
                content: [
                    { type: "paragraph", content: [{ type: "text", text: "Architecture" }] },
                    { type: "mediaImage", attrs: { mediaId: crypto.randomUUID(), alt: "deployment diagram" } }
                ]
            },
            status: "published"
        });
        const indexed = await env.DB.prepare("SELECT title, excerpt, body FROM _jamcaa_post_fts WHERE entry_id = ?")
            .bind(created.id)
            .first<{ title: string; excerpt: string; body: string }>();

        expect(indexed).toEqual({ title: "Projection", excerpt: "", body: "Architecture\ndeployment diagram" });

        expect((await search().search({ collection: post, query: "deployment diagram" })).matches).toEqual([
            expect.objectContaining({ entryId: created.id, excerpt: expect.stringContaining("deployment diagram") })
        ]);
    });

    it("keeps a word searchable when Rich Text marks split it across text nodes", async () => {
        const authorId = await anAuthor();
        const created = await posts(database()).create({
            slug: "marked-word",
            authorId,
            categoryId,
            title: "Marked text",
            body: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Archi" },
                            { type: "text", text: "tecture", marks: [{ type: "bold" }] }
                        ]
                    }
                ]
            },
            status: "published"
        });
        const indexed = await env.DB.prepare("SELECT body FROM _jamcaa_post_fts WHERE entry_id = ?")
            .bind(created.id)
            .first<{ body: string }>();

        expect(indexed?.body).toBe("Architecture");
        expect((await search().search({ collection: post, query: "Architecture" })).matches).toEqual([
            expect.objectContaining({ entryId: created.id })
        ]);
    });

    it("preserves hard breaks inside an inline Rich Text container", async () => {
        const authorId = await anAuthor();
        const created = await posts(database()).create({
            slug: "hard-break",
            authorId,
            categoryId,
            title: "Line break",
            body: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Cloudflare" },
                            { type: "hardBreak" },
                            { type: "text", text: "Workers" }
                        ]
                    }
                ]
            },
            status: "published"
        });
        const indexed = await env.DB.prepare("SELECT body FROM _jamcaa_post_fts WHERE entry_id = ?")
            .bind(created.id)
            .first<{ body: string }>();

        expect(indexed?.body).toBe("Cloudflare\nWorkers");
        expect((await search().search({ collection: post, query: "Cloudflare Workers" })).matches).toEqual([
            expect.objectContaining({ entryId: created.id })
        ]);
    });

    it("combines Category and Tag filters with AND", async () => {
        const authorId = await anAuthor();
        const terms = taxonomy(database());
        const guides = await terms.createCategory({ name: "Guides" });
        const featured = await terms.createTag({ name: "Featured" });
        const both = await posts(database()).create({
            slug: "both",
            authorId,
            categoryId: guides.id,
            title: "Cloudflare search",
            body: richTextFromPlainText("D1 guide"),
            status: "published"
        });
        await posts(database()).create({
            slug: "category-only",
            authorId,
            categoryId: guides.id,
            title: "Cloudflare search",
            body: richTextFromPlainText("D1 guide"),
            status: "published"
        });
        await replacePostTags(database(), both.id, [featured.id]);

        const page = await search().search({
            collection: post,
            query: "Cloudflare",
            filters: { categoryId: guides.id, tagId: featured.id }
        });

        expect(page.matches.map(match => match.entryId)).toEqual([both.id]);
    });

    it("paginates by rank and rowid without repeats", async () => {
        const authorId = await anAuthor();
        const store = posts(database());

        for (const slug of ["one", "two", "three"]) {
            await store.create({
                slug,
                authorId,
                categoryId,
                title: `Search ${slug}`,
                body: richTextFromPlainText("shared term"),
                status: "published"
            });
        }

        const first = await search().search({ collection: post, query: "shared", limit: 2 });
        const second = await search().search({ collection: post, query: "shared", limit: 2, cursor: first.nextCursor });

        expect(first.matches).toHaveLength(2);
        expect(first.nextCursor).toBeDefined();
        expect(second.matches).toHaveLength(1);
        expect(new Set([...first.matches, ...second.matches].map(match => match.entryId))).toHaveLength(3);
        expect(second.nextCursor).toBeUndefined();
    });

    it("resolves Search Matches to typed Entries without changing rank order", async () => {
        const authorId = await anAuthor();
        const store = posts(database());

        for (const slug of ["alpha", "beta"]) {
            await store.create({
                slug,
                authorId,
                categoryId,
                title: `Ranked ${slug}`,
                body: richTextFromPlainText("composition result"),
                status: "published"
            });
        }

        const adapterPage = await search().search({ collection: post, query: "composition result" });
        const sitePage = await searchPosts(database(), { query: "composition result" });

        expect(sitePage.results.map(result => result.entry.id)).toEqual(
            adapterPage.matches.map(match => match.entryId)
        );
        expect(sitePage.results.map(result => result.excerpt)).toEqual(adapterPage.matches.map(match => match.excerpt));
    });

    it("keeps the Entry store's batch read in requested order", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const first = await store.create({
            slug: "first",
            authorId,
            categoryId,
            title: "First",
            body: richTextFromPlainText("First")
        });
        const second = await store.create({
            slug: "second",
            authorId,
            categoryId,
            title: "Second",
            body: richTextFromPlainText("Second")
        });

        expect((await store.byIds([second.id, "missing", first.id])).map(entry => entry.id)).toEqual([
            second.id,
            first.id
        ]);
    });
});

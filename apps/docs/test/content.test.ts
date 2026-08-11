import { createDatabase } from "@jamcaa/core";
import { createAuth } from "@jamcaa/core/auth";
import { richTextFromPlainText, type RichTextDocument } from "@jamcaa/core/content";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { postSummaries, postTagIds, posts, replacePostTags, writePostWithTags } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

const categoryId = "jamcaa-default-category";

function database() {
    return createDatabase(env.DB);
}

function body(text = "A body") {
    return richTextFromPlainText(text);
}

async function anAuthor(email = "author@example.com") {
    const auth = createAuth({ database: database(), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
    const { user } = await auth.api.signUpEmail({
        body: { name: "Author", email, password: "correct-horse-battery-staple" }
    });

    return user.id;
}

/** Drizzle wraps the driver's error; the constraint that fired is in the cause. */
async function refusalFor(work: Promise<unknown>): Promise<string> {
    try {
        await work;
    } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;

        return cause instanceof Error ? cause.message : String(error);
    }

    throw new Error("Expected the database to refuse the query.");
}

describe("the table a declaration produced", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM _jamcaa_post_tag");
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM tag");
        await env.DB.exec("DELETE FROM category WHERE id <> 'jamcaa-default-category'");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("exists, because the migration was generated from the declaration", async () => {
        const table = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'post'"
        ).first<{ name: string }>();

        expect(table?.name).toBe("post");
    });

    it("migrates an existing Markdown body as plain rich text", async () => {
        const markdown = [
            "# Plain Markdown",
            "",
            "null",
            "true",
            "123",
            '"quoted text"',
            '{"example":"value"}',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"example"}]}]}'
        ];

        await env.DB.prepare(
            "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
            .bind("migration-author", "Migration Author", "migration@example.com", 1, Date.now(), Date.now())
            .run();

        for (const [index, source] of markdown.entries()) {
            await env.DB.prepare(
                "INSERT INTO post (id, slug, author_id, category_id, title, body) VALUES (?, ?, ?, ?, ?, ?)"
            )
                .bind(
                    `migration-${index}`,
                    `migration-${index}`,
                    "migration-author",
                    categoryId,
                    `Migration ${index}`,
                    source
                )
                .run();
        }

        const markdownMigration = env.TEST_MIGRATIONS.find(candidate => candidate.name.startsWith("0006_"));
        const canonicalMigration = env.TEST_MIGRATIONS.find(candidate => candidate.name.startsWith("0007_"));

        expect(markdownMigration).toBeDefined();
        expect(canonicalMigration).toBeDefined();

        for (const query of markdownMigration?.queries ?? []) {
            await env.DB.prepare(query).run();
        }

        for (const query of canonicalMigration?.queries ?? []) {
            await env.DB.prepare(query).run();
        }

        const rows = await env.DB.prepare("SELECT slug, body FROM post ORDER BY slug").all<{
            slug: string;
            body: string;
        }>();

        expect(rows.results).toHaveLength(markdown.length);

        for (const [index, source] of markdown.entries()) {
            const row = rows.results.find(candidate => candidate.slug === `migration-${index}`);

            expect(row).toBeDefined();
            expect(JSON.parse(row?.body ?? "null")).toEqual(richTextFromPlainText(source));
        }
    });

    it("keeps one slug to one entry", async () => {
        const authorId = await anAuthor();
        const entry = { slug: "taken", authorId, categoryId, title: "One", body: body() };

        await posts(database()).create(entry);

        expect(await refusalFor(posts(database()).create(entry))).toMatch(/UNIQUE constraint failed: post\.slug/i);
    });

    it("refuses an entry whose author does not exist", async () => {
        const orphan = { slug: "orphan", authorId: "nobody", categoryId, title: "Orphan", body: body() };

        expect(await refusalFor(posts(database()).create(orphan))).toMatch(/FOREIGN KEY constraint failed/i);
    });
});

describe("reading and writing entries", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM _jamcaa_post_tag");
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM tag");
        await env.DB.exec("DELETE FROM category WHERE id <> 'jamcaa-default-category'");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("returns the entry it just wrote", async () => {
        const authorId = await anAuthor();

        const created = await posts(database()).create({
            slug: "hello",
            authorId,
            categoryId,
            title: "Hello",
            body: body("Hello")
        });

        expect(created).toMatchObject({ slug: "hello", title: "Hello", body: body("Hello") });
        expect(created.id).toBeTruthy();
    });

    it("refuses invalid rich text at the core store boundary", async () => {
        const authorId = await anAuthor();

        await expect(
            posts(database()).create({
                slug: "invalid-body",
                authorId,
                categoryId,
                title: "Invalid",
                body: { type: "doc", content: [{ type: "html" }] } as unknown as RichTextDocument
            })
        ).rejects.toThrow(/unsupported rich text node/i);
    });

    it("fills in what the platform manages", async () => {
        const authorId = await anAuthor();

        const created = await posts(database()).create({
            slug: "defaults",
            authorId,
            categoryId,
            title: "D",
            body: body()
        });

        expect(created.status).toBe("draft");
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(created.publishedAt).toBeNull();
        expect(created.excerpt).toBeNull();
    });

    it("finds an entry by slug and by id", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "findable", authorId, categoryId, title: "F", body: body() });

        expect((await store.bySlug("findable"))?.id).toBe(created.id);
        expect((await store.byId(created.id))?.slug).toBe("findable");
        expect(await store.bySlug("absent")).toBeUndefined();
    });

    it("applies changes and leaves the rest alone", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "editable", authorId, categoryId, title: "Before", body: body() });

        await store.update(created.id, { title: "After", status: "published" });

        const updated = await store.byId(created.id);
        expect(updated).toMatchObject({ title: "After", status: "published", slug: "editable" });
    });

    it("lists newest first and can narrow to a status", async () => {
        const authorId = await anAuthor();
        const store = posts(database());

        await store.create({ slug: "one", authorId, categoryId, title: "One", body: body(), status: "published" });
        await store.create({ slug: "two", authorId, categoryId, title: "Two", body: body(), status: "draft" });

        expect(await store.list()).toHaveLength(2);
        expect((await store.list({ status: "published" })).map(entry => entry.slug)).toEqual(["one"]);
    });

    it("reads lightweight Published Entry Summaries", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({
            slug: "summary-projection",
            authorId,
            categoryId,
            title: "Summary projection",
            excerpt: "Lightweight",
            body: body("This body must not be returned."),
            status: "published"
        });
        await store.create({ slug: "summary-draft", authorId, categoryId, title: "Draft", body: body("Draft") });

        const page = await postSummaries(database()).list();
        const summary = page.summaries.find(candidate => candidate.id === created.id);

        expect(summary).toMatchObject({
            id: created.id,
            title: "Summary projection",
            excerpt: "Lightweight",
            status: "published"
        });
        expect(summary).not.toHaveProperty("body");
        expect(page.summaries.map(candidate => candidate.slug)).not.toContain("summary-draft");
    });

    it("orders Entry Summaries by public publication time and id", async () => {
        const authorId = await anAuthor();
        const timestamp = Date.now();

        await env.DB.prepare(
            `INSERT INTO post
                (id, slug, author_id, category_id, status, created_at, updated_at, published_at, title, excerpt, body)
             VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, NULL, ?)`
        )
            .bind(
                "summary-a",
                "summary-a",
                authorId,
                categoryId,
                timestamp,
                timestamp,
                timestamp,
                "A",
                JSON.stringify(body("A"))
            )
            .run();
        await env.DB.prepare(
            `INSERT INTO post
                (id, slug, author_id, category_id, status, created_at, updated_at, published_at, title, excerpt, body)
             VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, NULL, ?)`
        )
            .bind(
                "summary-b",
                "summary-b",
                authorId,
                categoryId,
                timestamp,
                timestamp,
                timestamp,
                "B",
                JSON.stringify(body("B"))
            )
            .run();

        const page = await postSummaries(database()).list({ limit: 1 });

        expect(page.summaries).toHaveLength(1);
        expect(page.summaries[0]?.id).toBe("summary-b");
    });

    it("narrows archives to direct Category ownership or Tag membership", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const terms = taxonomy(database());
        const category = await terms.createCategory({ name: "Guides" });
        const tag = await terms.createTag({ name: "Featured" });
        const direct = await store.create({
            slug: "direct",
            authorId,
            categoryId: category.id,
            title: "Direct",
            body: body(),
            status: "published"
        });
        await store.create({
            slug: "general",
            authorId,
            categoryId,
            title: "General",
            body: body(),
            status: "published"
        });
        await replacePostTags(database(), direct.id, [tag.id]);

        expect((await store.list({ status: "published", categoryId: category.id })).map(entry => entry.slug)).toEqual([
            "direct"
        ]);
        expect((await store.list({ status: "published", tagId: tag.id })).map(entry => entry.slug)).toEqual(["direct"]);
    });

    it("combines Entry Summary Category and Tag filters with AND", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const terms = taxonomy(database());
        const guides = await terms.createCategory({ name: "Summary Guides" });
        const news = await terms.createCategory({ name: "Summary News" });
        const featured = await terms.createTag({ name: "Summary Featured" });
        const matching = await store.create({
            slug: "summary-matching",
            authorId,
            categoryId: guides.id,
            title: "Matching",
            body: body(),
            status: "published"
        });
        const wrongCategory = await store.create({
            slug: "summary-wrong-category",
            authorId,
            categoryId: news.id,
            title: "Wrong category",
            body: body(),
            status: "published"
        });
        await replacePostTags(database(), matching.id, [featured.id]);
        await replacePostTags(database(), wrongCategory.id, [featured.id]);

        const page = await postSummaries(database()).list({ categoryId: guides.id, tagId: featured.id });

        expect(page.summaries.map(summary => summary.slug)).toEqual(["summary-matching"]);
    });

    it("validates Entry Summary limits", async () => {
        const summaries = postSummaries(database());

        await expect(summaries.list({ limit: 0 })).rejects.toThrow(/integer from 1 to 50/i);
        await expect(summaries.list({ limit: 51 })).rejects.toThrow(/integer from 1 to 50/i);
    });

    it("pages Entry Summaries by keyset without repeats or gaps", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const moment = new Date("2026-08-01T00:00:00.000Z");

        for (const name of ["a", "b", "c", "d", "e"]) {
            await store.create({
                slug: `page-${name}`,
                authorId,
                categoryId,
                title: name.toUpperCase(),
                body: body(),
                status: "published",
                publishedAt: moment
            });
        }

        const summaries = postSummaries(database());
        const whole = await summaries.list({ limit: 50 });
        const first = await summaries.list({ limit: 2 });
        const second = await summaries.list({ limit: 2, cursor: first.nextCursor });
        const third = await summaries.list({ limit: 2, cursor: second.nextCursor });
        const seen = [...first.summaries, ...second.summaries, ...third.summaries].map(summary => summary.slug);

        expect(first.nextCursor).toBeDefined();
        expect(second.nextCursor).toBeDefined();
        expect(third.nextCursor).toBeUndefined();
        expect(seen).toEqual(whole.summaries.map(summary => summary.slug));
        expect(new Set(seen).size).toBe(5);
        expect(whole.nextCursor).toBeUndefined();
    });

    it("refuses an unreadable Entry Summary cursor", async () => {
        await expect(postSummaries(database()).list({ cursor: "not+a+cursor" })).rejects.toThrow(/cursor is invalid/i);
    });

    it("cascades Tag membership when an Entry is removed", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const tag = await taxonomy(database()).createTag({ name: "Temporary" });
        const created = await store.create({ slug: "tagged", authorId, categoryId, title: "Tagged", body: body() });
        await replacePostTags(database(), created.id, [tag.id]);

        await store.remove(created.id);

        const relations = await env.DB.prepare("SELECT COUNT(*) AS count FROM _jamcaa_post_tag WHERE entry_id = ?")
            .bind(created.id)
            .first<{ count: number }>();
        expect(relations?.count).toBe(0);
    });

    it("rolls back an Entry write when Tag membership is invalid", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({
            slug: "transactional",
            authorId,
            categoryId,
            title: "Before",
            body: body()
        });
        const tag = await taxonomy(database()).createTag({ name: "Valid" });
        await replacePostTags(database(), created.id, [tag.id]);

        await expect(
            writePostWithTags(
                database(),
                ["missing-tag"],
                async () => {
                    await store.update(created.id, { title: "After" });
                    return created.id;
                },
                postId => postId
            )
        ).rejects.toThrow();

        expect((await store.byId(created.id))?.title).toBe("Before");
        expect(await postTagIds(database(), created.id)).toEqual([tag.id]);
    });

    it("removes an entry", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "doomed", authorId, categoryId, title: "D", body: body() });

        await store.remove(created.id);

        expect(await store.byId(created.id)).toBeUndefined();
    });
});

describe("managing taxonomy", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM _jamcaa_post_tag");
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM tag");
        await env.DB.exec("DELETE FROM category WHERE id <> 'jamcaa-default-category'");
    });

    it("creates hierarchical Categories and refuses a cycle", async () => {
        const terms = taxonomy(database());
        const parent = await terms.createCategory({ name: "Parent" });
        const child = await terms.createCategory({ name: "Child", parentId: parent.id });

        expect(await terms.categoryBySlug("child")).toMatchObject({ parentId: parent.id });
        await expect(terms.updateCategory(parent.id, { parentId: child.id })).rejects.toThrow(/own descendant/i);
    });

    it("refuses to remove a Category that still has children or Entries", async () => {
        const terms = taxonomy(database());
        const parent = await terms.createCategory({ name: "Parent" });
        await terms.createCategory({ name: "Child", parentId: parent.id });

        await expect(terms.removeCategory(parent.id)).rejects.toThrow(/children first/i);

        const assigned = await terms.createCategory({ name: "Assigned" });
        const authorId = await anAuthor("taxonomy-author@example.com");
        await posts(database()).create({
            slug: "assigned",
            authorId,
            categoryId: assigned.id,
            title: "Assigned",
            body: body()
        });

        expect(await refusalFor(terms.removeCategory(assigned.id))).toMatch(/FOREIGN KEY constraint failed/i);
    });

    it("creates and updates a Tag through its slug", async () => {
        const terms = taxonomy(database());
        const created = await terms.createTag({ name: "First Tag" });

        await terms.updateTag(created.id, { name: "Renamed Tag", slug: "renamed" });

        expect(await terms.tagBySlug("renamed")).toMatchObject({ id: created.id, name: "Renamed Tag" });
    });
});

describe("what the store promises the compiler", () => {
    it("hands back entries shaped by the declaration", () => {
        type Post = Awaited<ReturnType<ReturnType<typeof posts>["bySlug"]>>;

        expectTypeOf<NonNullable<Post>["title"]>().toEqualTypeOf<string>();
        expectTypeOf<NonNullable<Post>["body"]>().toEqualTypeOf<RichTextDocument>();
        expectTypeOf<NonNullable<Post>["excerpt"]>().toEqualTypeOf<string | null>();
        expectTypeOf<NonNullable<Post>["categoryId"]>().toEqualTypeOf<string>();
        expectTypeOf<NonNullable<Post>["status"]>().toEqualTypeOf<"draft" | "published" | "archived">();
    });
});

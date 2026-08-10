import { createDatabase } from "@jamcaa/core";
import { createAuth } from "@jamcaa/core/auth";
import { richTextFromPlainText, type RichTextDocument } from "@jamcaa/core/content";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { posts } from "@/content/store";

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
        await env.DB.exec("DELETE FROM post");
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
            await env.DB.prepare("INSERT INTO post (id, slug, author_id, title, body) VALUES (?, ?, ?, ?, ?)")
                .bind(`migration-${index}`, `migration-${index}`, "migration-author", `Migration ${index}`, source)
                .run();
        }

        const migration = env.TEST_MIGRATIONS.find(candidate => candidate.name.startsWith("0006_"));

        expect(migration).toBeDefined();

        for (const query of migration?.queries ?? []) {
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
        const entry = { slug: "taken", authorId, title: "One", body: body() };

        await posts(database()).create(entry);

        expect(await refusalFor(posts(database()).create(entry))).toMatch(/UNIQUE constraint failed: post\.slug/i);
    });

    it("refuses an entry whose author does not exist", async () => {
        const orphan = { slug: "orphan", authorId: "nobody", title: "Orphan", body: body() };

        expect(await refusalFor(posts(database()).create(orphan))).toMatch(/FOREIGN KEY constraint failed/i);
    });
});

describe("reading and writing entries", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("returns the entry it just wrote", async () => {
        const authorId = await anAuthor();

        const created = await posts(database()).create({
            slug: "hello",
            authorId,
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
                title: "Invalid",
                body: { type: "doc", content: [{ type: "html" }] } as unknown as RichTextDocument
            })
        ).rejects.toThrow(/unsupported rich text node/i);
    });

    it("fills in what the platform manages", async () => {
        const authorId = await anAuthor();

        const created = await posts(database()).create({ slug: "defaults", authorId, title: "D", body: body() });

        expect(created.status).toBe("draft");
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(created.publishedAt).toBeNull();
        expect(created.excerpt).toBeNull();
    });

    it("finds an entry by slug and by id", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "findable", authorId, title: "F", body: body() });

        expect((await store.bySlug("findable"))?.id).toBe(created.id);
        expect((await store.byId(created.id))?.slug).toBe("findable");
        expect(await store.bySlug("absent")).toBeUndefined();
    });

    it("applies changes and leaves the rest alone", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "editable", authorId, title: "Before", body: body() });

        await store.update(created.id, { title: "After", status: "published" });

        const updated = await store.byId(created.id);
        expect(updated).toMatchObject({ title: "After", status: "published", slug: "editable" });
    });

    it("lists newest first and can narrow to a status", async () => {
        const authorId = await anAuthor();
        const store = posts(database());

        await store.create({ slug: "one", authorId, title: "One", body: body(), status: "published" });
        await store.create({ slug: "two", authorId, title: "Two", body: body(), status: "draft" });

        expect(await store.list()).toHaveLength(2);
        expect((await store.list({ status: "published" })).map(entry => entry.slug)).toEqual(["one"]);
    });

    it("removes an entry", async () => {
        const authorId = await anAuthor();
        const store = posts(database());
        const created = await store.create({ slug: "doomed", authorId, title: "D", body: body() });

        await store.remove(created.id);

        expect(await store.byId(created.id)).toBeUndefined();
    });
});

describe("what the store promises the compiler", () => {
    it("hands back entries shaped by the declaration", () => {
        type Post = Awaited<ReturnType<ReturnType<typeof posts>["bySlug"]>>;

        expectTypeOf<NonNullable<Post>["title"]>().toEqualTypeOf<string>();
        expectTypeOf<NonNullable<Post>["body"]>().toEqualTypeOf<RichTextDocument>();
        expectTypeOf<NonNullable<Post>["excerpt"]>().toEqualTypeOf<string | null>();
        expectTypeOf<NonNullable<Post>["status"]>().toEqualTypeOf<"draft" | "published" | "archived">();
    });
});

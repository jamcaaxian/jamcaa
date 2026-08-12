import { createDatabase } from "@jamcaa/core";
import {
    buildRevisionTable,
    buildTable,
    choice,
    declaredFieldStorage,
    defineCollection,
    entryRevisionSnapshot,
    entryRevisionStore,
    entryStore,
    markdown,
    moment,
    number,
    reference,
    richText,
    richTextFromPlainText,
    text,
    toggle,
    type EntryOf
} from "@jamcaa/core/content";
import { env } from "cloudflare:test";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const probe = defineCollection({
    name: "write_probe",
    label: "Write Probe",
    plural: "Write Probes",
    fields: {
        title: text({ required: true }),
        longNote: markdown(),
        body: richText({ required: true }),
        score: number(),
        count: number({ whole: true, required: true }),
        featured: toggle(),
        happenedAt: moment(),
        state: choice({ of: ["draft", "published"] as const, required: true }),
        parent: reference({ to: "write_probe" })
    }
});

const table = buildTable(probe);
const revisionTable = buildRevisionTable(probe.name, table);

type Probe = EntryOf<typeof probe>;

function database() {
    return createDatabase(env.DB);
}

function entry(overrides: Partial<Probe> = {}): Probe {
    return {
        id: "entry-1",
        slug: "entry-one",
        status: "draft",
        authorId: "author-1",
        categoryId: "category-1",
        createdAt: new Date("2026-08-12T08:00:00.000Z"),
        updatedAt: new Date("2026-08-12T08:01:00.000Z"),
        publishedAt: null,
        title: "First title",
        longNote: "  Markdown stays exact.  ",
        body: richTextFromPlainText("First body"),
        score: 4.5,
        count: 3,
        featured: true,
        happenedAt: new Date("2026-08-12T09:00:00.000Z"),
        state: "draft",
        parent: null,
        ...overrides
    };
}

function insertStatement(value: Probe): D1PreparedStatement {
    const fields = declaredFieldStorage(probe, value);

    return database()
        .$client.prepare(
            "INSERT INTO write_probe "
                + `(id, slug, status, author_id, category_id, created_at, updated_at, published_at, ${fields.columns}) `
                + `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${fields.placeholders})`
        )
        .bind(
            value.id,
            value.slug,
            value.status,
            value.authorId,
            value.categoryId,
            value.createdAt.getTime(),
            value.updatedAt.getTime(),
            value.publishedAt?.getTime() ?? null,
            ...fields.bindings
        );
}

function updateStatement(before: Probe, after: Probe): D1PreparedStatement {
    const fields = declaredFieldStorage(probe, after);

    return database()
        .$client.prepare(
            "UPDATE write_probe SET slug = ?, status = ?, "
                + "category_id = CASE WHEN updated_at = ? THEN ? ELSE NULL END, "
                + `updated_at = ?, published_at = ?, ${fields.assignments} WHERE id = ?`
        )
        .bind(
            after.slug,
            after.status,
            before.updatedAt.getTime(),
            after.categoryId,
            after.updatedAt.getTime(),
            after.publishedAt?.getTime() ?? null,
            ...fields.bindings,
            after.id
        );
}

const createStatements = [
    `CREATE TABLE write_probe (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL,
        status TEXT NOT NULL,
        author_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER,
        title TEXT NOT NULL,
        long_note TEXT,
        body TEXT NOT NULL,
        score REAL,
        count INTEGER NOT NULL,
        featured INTEGER,
        happened_at INTEGER,
        state TEXT NOT NULL,
        parent TEXT
    )`,
    `CREATE TABLE _jamcaa_write_probe_revision (
        ordinal INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        entry_id TEXT NOT NULL,
        format_version INTEGER NOT NULL,
        snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES write_probe(id) ON DELETE CASCADE
    )`
];

async function dropProbeTables() {
    await env.DB.prepare("DROP TABLE IF EXISTS _jamcaa_write_probe_revision").run();
    await env.DB.prepare("DROP TABLE IF EXISTS write_probe").run();
}

describe("declared Entry writes", () => {
    beforeEach(async () => {
        await dropProbeTables();

        for (const statement of createStatements) {
            await env.DB.prepare(statement).run();
        }
    });

    afterAll(dropProbeTables);

    it("inserts and updates every declared Field with the right database representation", async () => {
        const first = entry();

        await insertStatement(first).run();

        const inserted = await env.DB.prepare("SELECT * FROM write_probe WHERE id = ?")
            .bind(first.id)
            .first<{
                long_note: string;
                body: string;
                score: number;
                count: number;
                featured: number;
                happened_at: number;
                state: string;
                parent: string | null;
            }>();

        expect(inserted).toMatchObject({
            long_note: "  Markdown stays exact.  ",
            body: JSON.stringify(first.body),
            score: 4.5,
            count: 3,
            featured: 1,
            happened_at: first.happenedAt?.getTime(),
            state: "draft",
            parent: null
        });

        const second = entry({
            updatedAt: new Date("2026-08-12T08:02:00.000Z"),
            longNote: null,
            body: richTextFromPlainText("Second body"),
            score: null,
            count: 7,
            featured: false,
            happenedAt: null,
            state: "published",
            parent: "entry-parent"
        });

        await updateStatement(first, second).run();

        await expect(entryStore({ database: database(), collection: probe, table }).byId(first.id)).resolves.toEqual(
            second
        );
    });

    it("keeps the Site-owned NOT NULL sentinel when an update is stale", async () => {
        const first = entry();

        await insertStatement(first).run();
        await updateStatement(
            first,
            entry({ updatedAt: new Date("2026-08-12T08:02:00.000Z"), title: "Stored change" })
        ).run();

        await expect(
            updateStatement(
                first,
                entry({ updatedAt: new Date("2026-08-12T08:03:00.000Z"), title: "Stale change" })
            ).run()
        ).rejects.toThrow();

        await expect(
            entryStore({ database: database(), collection: probe, table }).byId(first.id)
        ).resolves.toMatchObject({ title: "Stored change" });
    });

    it("round-trips every declared Field through a typed Revision snapshot", async () => {
        const stored = entry();

        await insertStatement(stored).run();

        const revisions = entryRevisionStore({ database: database(), collection: probe, table: revisionTable });
        const snapshot = entryRevisionSnapshot(probe, stored, ["tag-2", "tag-1", "tag-2"]);
        const appended = await revisions.append(stored.id, snapshot);
        const raw = await env.DB.prepare("SELECT snapshot FROM _jamcaa_write_probe_revision WHERE id = ?")
            .bind(appended.id)
            .first<{ snapshot: string }>();
        const encoded = JSON.parse(raw!.snapshot) as { fields: Record<string, unknown> };

        expect(encoded.fields.happenedAt).toBe(stored.happenedAt?.getTime());
        expect(encoded.fields.featured).toBe(true);
        expect(encoded.fields.body).toEqual(stored.body);
        await expect(revisions.byId(stored.id, appended.id)).resolves.toEqual(appended);
        expect(appended.snapshot.fields.happenedAt).toEqual(stored.happenedAt);
        expect(appended.snapshot.tagIds).toEqual(["tag-1", "tag-2"]);
    });
});

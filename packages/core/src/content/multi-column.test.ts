import { env } from "cloudflare:test";
import { getTableConfig, real as sqliteReal } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../db/client";
import { defineCollection } from "./collection";
import { declaredFieldStorage, entryStore } from "./entries";
import { compileField, capsuleOf, revisionCodecV1, slot } from "./field-capsule";
import { canonicalFieldValue } from "./field-values";
import { decodePhysicalCells, physicalLayout } from "./field-layout";
import { text, type Field } from "./fields";
import { defineContentModel } from "./model";
import { buildRevisionTable, entryRevisionSnapshot, entryRevisionStore } from "./revisions";
import { entrySummaryReader } from "./summaries";
import { buildTable } from "./table";

interface GeoPoint {
    latitude: number;
    longitude: number;
}

/** A test-only compound Field: one logical value, two physical slots. */
function geoPoint(options: { required?: boolean } = {}): Field<GeoPoint | null, "number"> {
    const required = options.required ?? false;

    return compileField(
        {
            // Typed as "number" so Entry Summary eligibility accepts it until
            // Field traits become ability-derived; the capsule owns the behavior.
            kind: "@test/geo-point" as "number",
            label: undefined,
            description: undefined,
            required,
            parse: value => {
                if (typeof value !== "object" || value === null) {
                    throw new Error("A geo point Field needs coordinates.");
                }

                const point = value as { latitude?: unknown; longitude?: unknown };

                if (
                    typeof point.latitude !== "number"
                    || !Number.isFinite(point.latitude)
                    || typeof point.longitude !== "number"
                    || !Number.isFinite(point.longitude)
                ) {
                    throw new Error("A geo point Field needs finite coordinates.");
                }

                return { latitude: point.latitude, longitude: point.longitude };
            }
        },
        {
            slots: () => ({
                latitude: slot({ affinity: "real", buildColumn: name => realBuilder(name) }),
                longitude: slot({ affinity: "real", buildColumn: name => realBuilder(name) })
            }),
            encode: (value: GeoPoint) => ({ latitude: value.latitude, longitude: value.longitude }),
            decode: cells => ({ latitude: cells.latitude, longitude: cells.longitude }),
            snapshotValue: (value: GeoPoint) => ({ latitude: value.latitude, longitude: value.longitude }),
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: GeoPoint) => ({ latitude: value.latitude, longitude: value.longitude }),
                value => value
            ),
            storageVersion: () => 1,
            searchVersion: () => 1,
            submissionValue: raw => JSON.parse(raw) as unknown,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined,
            searchText: () => undefined
        }
    );
}

function realBuilder(name: string) {
    return sqliteReal(name);
}

const place = defineCollection({
    name: "place",
    label: "Place",
    plural: "Places",
    fields: { title: text({ required: true }), location: geoPoint(), home: geoPoint({ required: true }) },
    summary: { fields: ["title", "location"] }
});

const model = defineContentModel([place]);
const table = model.table("place")!;

const revisionTable = buildRevisionTable(place.name, table);

const createPlaceTable = `CREATE TABLE place (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL,
    author_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER,
    title TEXT NOT NULL,
    location__latitude REAL,
    location__longitude REAL,
    home__latitude REAL NOT NULL,
    home__longitude REAL NOT NULL
)`;

const createRevisionTable = `CREATE TABLE _jamcaa_place_revision (
    ordinal INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    entry_id TEXT NOT NULL,
    format_version INTEGER NOT NULL,
    snapshot TEXT NOT NULL CHECK (json_valid(snapshot)),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES place(id) ON DELETE CASCADE
)`;

function database() {
    return createDatabase(env.DB);
}

beforeAll(async () => {
    await env.DB.prepare(createPlaceTable).run();
    await env.DB.prepare(createRevisionTable).run();
});

afterAll(async () => {
    await env.DB.prepare("DROP TABLE IF EXISTS _jamcaa_place_revision").run();
    await env.DB.prepare("DROP TABLE IF EXISTS place").run();
});

describe("multi-column Field layouts", () => {
    it("resolves compound slots to field__slot columns and keeps single slots plain", () => {
        const layout = physicalLayout(place.name, place.fields);

        expect(layout.total).toBe(8 + 1 + 2 + 2);
        expect(layout.byField.location?.columns).toEqual(["location__latitude", "location__longitude"]);
        expect(layout.byField.title?.columns).toEqual(["title"]);
    });

    it("builds every slot with required-only NOT NULL", () => {
        const columns = new Map(getTableConfig(buildTable(place)).columns.map(column => [column.name, column]));

        expect(columns.get("location__latitude")?.getSQLType()).toBe("real");
        expect(columns.get("location__latitude")?.notNull).toBe(false);
        expect(columns.get("home__latitude")?.notNull).toBe(true);
    });

    it("refuses a physical column that collides with the platform's own columns", () => {
        expect(() => physicalLayout("probe", { slug: text() })).toThrow(
            /collides with another physical column "slug"/i
        );
    });

    it("counts physical columns against the D1 budget", () => {
        const fields: Record<string, Field> = { title: text({ required: true }) };

        for (let index = 0; index < 46; index += 1) {
            fields[`point${index}`] = geoPoint();
        }

        expect(() => defineCollection({ name: "too_wide", label: "x", plural: "x", fields })).toThrow(/D1 allows 100/i);

        delete fields.point45;
        expect(() => defineCollection({ name: "exact", label: "x", plural: "x", fields })).not.toThrow();
    });

    it("writes and reads one logical value through several physical bindings", async () => {
        const store = entryStore({ database: database(), collection: place, table });

        await store.create({
            slug: "shanghai",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Shanghai",
            location: { latitude: 31.23, longitude: 121.47 },
            home: { latitude: 30.7, longitude: 121.5 }
        });

        const stored = await store.bySlug("shanghai");

        expect(stored?.location).toEqual({ latitude: 31.23, longitude: 121.47 });
        expect(stored?.home).toEqual({ latitude: 30.7, longitude: 121.5 });
    });

    it("keeps optional all-null slots as a null logical value and refuses partial corruption", async () => {
        const store = entryStore({ database: database(), collection: place, table });

        await env.DB.prepare("DELETE FROM place").run();
        await store.create({
            slug: "empty",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Empty location",
            location: null,
            home: { latitude: 1, longitude: 2 }
        });

        await expect(store.bySlug("empty")).resolves.toMatchObject({ location: null });

        await env.DB.prepare(
            "INSERT INTO place (id, slug, status, author_id, category_id, title, location__latitude, location__longitude, home__latitude, home__longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
            .bind(
                "broken",
                "broken",
                "draft",
                "author-1",
                "category-1",
                "Broken",
                null,
                121.47,
                1,
                2,
                Date.now(),
                Date.now()
            )
            .run();

        await expect(store.bySlug("broken")).rejects.toThrow(/required slot "latitude"/i);
    });

    it("refuses a required all-null shape as storage corruption", () => {
        const required = geoPoint({ required: true });

        // The NOT NULL DDL already blocks this shape at write time; the decode
        // layer is the second defense for rows that predate or bypass it.
        expect(() =>
            canonicalFieldValue(required, decodePhysicalCells(required, { latitude: null, longitude: null }))
        ).toThrow(/cannot be null/i);
        expect(() => decodePhysicalCells(required, { latitude: null, longitude: 2 })).toThrow(
            /required slot "latitude"/i
        );
    });

    it("updates one compound Field atomically and validates it first", async () => {
        const store = entryStore({ database: database(), collection: place, table });

        await env.DB.prepare("DELETE FROM place").run();
        await store.create({
            slug: "moving",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Moving",
            location: null,
            home: { latitude: 1, longitude: 2 }
        });

        const stored = await store.bySlug("moving");
        const id = stored!.id;

        await store.update(id, { location: { latitude: 9, longitude: 8 } });

        const after = await store.bySlug("moving");

        expect(after?.location).toEqual({ latitude: 9, longitude: 8 });
        expect(after?.home).toEqual({ latitude: 1, longitude: 2 });
        await expect(store.update(id, { location: { latitude: Number.NaN, longitude: 2 } as never })).rejects.toThrow(
            /finite coordinates/i
        );
    });

    it("derives declared write fragments and bindings slot by slot", () => {
        expect(
            declaredFieldStorage(place, {
                title: "Shanghai",
                location: { latitude: 31.23, longitude: 121.47 },
                home: { latitude: 1, longitude: 2 }
            })
        ).toEqual({
            columns: '"title", "location__latitude", "location__longitude", "home__latitude", "home__longitude"',
            placeholders: "?, ?, ?, ?, ?",
            assignments:
                '"title" = ?, "location__latitude" = ?, "location__longitude" = ?, "home__latitude" = ?, "home__longitude" = ?',
            bindings: ["Shanghai", 31.23, 121.47, 1, 2]
        });
    });

    it("round-trips a compound Field through Revision format v2 envelopes", async () => {
        const store = entryStore({ database: database(), collection: place, table });
        const stored = await store.create({
            slug: "revisioned",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Revisioned",
            location: { latitude: 31.23, longitude: 121.47 },
            home: { latitude: 30.7, longitude: 121.5 }
        });
        const revisions = entryRevisionStore({ database: database(), collection: place, table: revisionTable });
        const appended = await revisions.append(
            stored.id,
            entryRevisionSnapshot(place, stored, ["tag-2", "tag-1", "tag-2"])
        );
        const raw = await env.DB.prepare("SELECT format_version, snapshot FROM _jamcaa_place_revision WHERE id = ?")
            .bind(appended.id)
            .first<{ format_version: number; snapshot: string }>();

        expect(raw?.format_version).toBe(2);
        const encoded = JSON.parse(raw!.snapshot) as { fields: Record<string, unknown> };

        expect(encoded.fields.location).toEqual({
            $field: { kind: "@test/geo-point", codec: 1, value: { latitude: 31.23, longitude: 121.47 } }
        });
        await expect(revisions.byId(stored.id, appended.id)).resolves.toMatchObject({
            snapshot: { fields: { location: { latitude: 31.23, longitude: 121.47 } } }
        });
    });

    it("keeps Revision format v1 rows readable through the legacy path", async () => {
        const store = entryStore({ database: database(), collection: place, table });
        const stored = await store.create({
            slug: "legacy",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Legacy",
            location: { latitude: 31.23, longitude: 121.47 },
            home: { latitude: 30.7, longitude: 121.5 }
        });
        const revisions = entryRevisionStore({ database: database(), collection: place, table: revisionTable });

        await env.DB.prepare(
            "INSERT INTO _jamcaa_place_revision (id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(
                "legacy-revision",
                stored.id,
                1,
                JSON.stringify({
                    slug: "shanghai",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: {
                        title: "Shanghai",
                        location: { latitude: 31.23, longitude: 121.47 },
                        home: { latitude: 30.7, longitude: 121.5 }
                    },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "legacy-revision")).resolves.toMatchObject({
            snapshot: { fields: { location: { latitude: 31.23, longitude: 121.47 } } }
        });
    });

    it("refuses kind mismatches and unknown codecs in Revision v2 rows", async () => {
        const store = entryStore({ database: database(), collection: place, table });
        const stored = await store.create({
            slug: "guarded",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Guarded",
            location: null,
            home: { latitude: 1, longitude: 2 }
        });
        const revisions = entryRevisionStore({ database: database(), collection: place, table: revisionTable });

        await env.DB.prepare(
            "INSERT INTO _jamcaa_place_revision (id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(
                "wrong-kind",
                stored.id,
                2,
                JSON.stringify({
                    slug: "shanghai",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: { title: { $field: { kind: "moment", codec: 1, value: 1 } }, location: null, home: null },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "wrong-kind")).rejects.toThrow(/belongs to moment rather than text/i);

        await env.DB.prepare(
            "INSERT INTO _jamcaa_place_revision (id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(
                "unknown-codec",
                stored.id,
                2,
                JSON.stringify({
                    slug: "shanghai",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: {
                        title: { $field: { kind: "text", codec: 7, value: "Shanghai" } },
                        location: null,
                        home: null
                    },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "unknown-codec")).rejects.toThrow(/codec 7 is not known/i);

        await env.DB.prepare(
            "INSERT INTO _jamcaa_place_revision (id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(
                "no-envelope",
                stored.id,
                2,
                JSON.stringify({
                    slug: "guarded",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: { title: "bare value", location: null, home: null },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "no-envelope")).rejects.toThrow(/has no codec envelope/i);

        await env.DB.prepare(
            "INSERT INTO _jamcaa_place_revision (id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(
                "future-format",
                stored.id,
                3,
                JSON.stringify({
                    slug: "guarded",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: {
                        title: { $field: { kind: "text", codec: 1, value: "Guarded" } },
                        location: null,
                        home: null
                    },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "future-format")).rejects.toThrow(/format version 3 is not known/i);
    });

    it("refuses a Search text expression over an unknown slot at declaration time", () => {
        const base = text({ required: true });
        const bogus = compileField(base, {
            ...capsuleOf(base),
            searchText: () => ({ type: "column-text", slot: "other" })
        });

        expect(() =>
            defineCollection({
                name: "bogus_search",
                label: "Bogus",
                plural: "Bogus",
                fields: { title: bogus },
                search: { fields: ["title"] }
            })
        ).toThrow(/unknown slot "other"/i);
    });

    it("rebuilds one logical value in an Entry Summary from every slot", async () => {
        await env.DB.prepare("DELETE FROM place").run();
        await env.DB.prepare(
            "INSERT INTO place (id, slug, status, author_id, category_id, title, location__latitude, location__longitude, home__latitude, home__longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
            .bind(
                "listed",
                "listed",
                "published",
                "author-1",
                "category-1",
                "Listed",
                31.23,
                121.47,
                1,
                2,
                Date.now(),
                Date.now()
            )
            .run();

        const reader = entrySummaryReader({ database: database(), model, collection: place });
        const page = await reader.list();

        expect(page.summaries).toHaveLength(1);
        expect(page.summaries[0]?.location).toEqual({ latitude: 31.23, longitude: 121.47 });
        expect(page.summaries[0]?.title).toBe("Listed");
    });
});

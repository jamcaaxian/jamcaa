import { env } from "cloudflare:test";
import { getTableConfig, real as sqliteReal } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { createDatabase } from "../db/client";
import { searchArtifactDescriptor, searchProjection, searchProjectionSql } from "../search";
import { defineCollection, type EntryOf } from "./collection";
import { entryStore } from "./entries";
import { parseCollectionSubmission } from "./editing";
import { slot, type SQLiteCell } from "./field-capsule";
import { defineFieldType } from "./field-types";
import { text } from "./fields";
import { defineContentModel } from "./model";
import { buildRevisionTable, entryRevisionSnapshot, entryRevisionStore } from "./revisions";
import { entrySummaryReader } from "./summaries";
import { buildTable } from "./table";

interface GeoPoint {
    latitude: number;
    longitude: number;
}

function realBuilder(name: string) {
    return sqliteReal(name);
}

function parseGeoPoint(value: unknown): GeoPoint {
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

/**
 * The conformance Field Type: two physical columns, Revision codec v2, and a
 * compound Search projection through the restricted expression algebra.
 */
const geoPointType = defineFieldType<GeoPoint, "@test/geo-point">({
    kind: "@test/geo-point",
    parse: parseGeoPoint,
    capsule: {
        slots: () => ({
            latitude: slot({ affinity: "real", buildColumn: name => realBuilder(name) }),
            longitude: slot({ affinity: "real", buildColumn: name => realBuilder(name) })
        }),
        storageVersion: () => 1,
        searchVersion: () => 1,
        encode: (value: GeoPoint): Record<string, SQLiteCell> => ({
            latitude: value.latitude,
            longitude: value.longitude
        }),
        decode: cells => ({ latitude: cells.latitude, longitude: cells.longitude }),
        snapshotValue: (value: GeoPoint) => ({ latitude: value.latitude, longitude: value.longitude }),
        valueFromSnapshot: value => value,
        revisionVersion: () => 2,
        revisionEncode: (value: GeoPoint) => ({ latitude: value.latitude, longitude: value.longitude }),
        revisionDecode: (version, payload) => {
            if (version !== 2) {
                throw new Error(`Revision codec ${version} is not known.`);
            }

            return payload;
        },
        submissionValue: raw => JSON.parse(raw) as unknown,
        isBlankSubmission: raw => raw.trim().length === 0,
        isRequiredValueMissing: () => false,
        editingExtras: () => ({ latitudeLabel: "Latitude", longitudeLabel: "Longitude" }),
        searchText: () => ({ type: "columns-text", slots: ["latitude", "longitude"] })
    }
});

const place = defineCollection({
    name: "place",
    label: "Place",
    plural: "Places",
    fields: {
        title: text({ required: true }),
        location: geoPointType.create(),
        home: geoPointType.create({ required: true })
    },
    search: { fields: ["title", "location"] },
    summary: { fields: ["title", "location"] }
});

const model = defineContentModel({ collections: [place], fieldTypes: [geoPointType] });
const table = model.table("place")!;

const revisionTable = buildRevisionTable(place.name, table);

const createPlaceTable = `CREATE TABLE place (
    id TEXT PRIMARY KEY NOT NULL,
    locale TEXT NOT NULL DEFAULT 'und',
    translation_id TEXT,
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

describe("Geo Point conformance", () => {
    it("derives the GeoPoint Entry type without casts", () => {
        expectTypeOf<EntryOf<typeof place>>().toMatchTypeOf<{
            title: string;
            location: GeoPoint | null;
            home: GeoPoint;
        }>();
    });

    it("compiles both slots into physical columns", () => {
        const columns = new Map(getTableConfig(buildTable(place)).columns.map(column => [column.name, column]));

        expect(columns.get("location__latitude")?.getSQLType()).toBe("real");
        expect(columns.get("location__longitude")?.notNull).toBe(false);
        expect(columns.get("home__longitude")?.notNull).toBe(true);
    });

    it("writes and reads one logical value through two physical bindings", async () => {
        const store = entryStore({ database: database(), collection: place, table });

        await store.create({
            slug: "shanghai",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Shanghai",
            location: { latitude: 31.23, longitude: 121.47 },
            home: { latitude: 30.7, longitude: 121.5 }
        });

        await expect(store.bySlug("shanghai")).resolves.toMatchObject({
            location: { latitude: 31.23, longitude: 121.47 }
        });
    });

    it("updates both slots of one logical value atomically", async () => {
        const store = entryStore({ database: database(), collection: place, table });
        const stored = await store.create({
            slug: "moving",
            authorId: "author-1",
            categoryId: "category-1",
            title: "Moving",
            location: null,
            home: { latitude: 1, longitude: 2 }
        });

        await store.update(stored.id, { location: { latitude: 9, longitude: 8 } });

        await expect(store.bySlug("moving")).resolves.toMatchObject({
            location: { latitude: 9, longitude: 8 },
            home: { latitude: 1, longitude: 2 }
        });
        await expect(
            store.update(stored.id, { location: { latitude: Number.NaN, longitude: 2 } as never })
        ).rejects.toThrow(/finite coordinates/i);
    });

    it("refuses a compound Search expression with no slots at declaration time", () => {
        const empty = defineFieldType<GeoPoint, "@test/geo-empty">({
            kind: "@test/geo-empty",
            parse: parseGeoPoint,
            capsule: { ...geoPointType.capsule, searchText: () => ({ type: "columns-text", slots: [] }) }
        });

        expect(() =>
            defineCollection({
                name: "empty_search",
                label: "Empty",
                plural: "Empty",
                fields: { title: text({ required: true }), location: empty.create() },
                search: { fields: ["location"] }
            })
        ).toThrow(/Search text expression with no slots/);
    });

    it("parses one submitted JSON string into a compound value", () => {
        const form = new FormData();

        form.append("title", "Shanghai");
        form.append("location", JSON.stringify({ latitude: 31.23, longitude: 121.47 }));
        form.append("home", JSON.stringify({ latitude: 30.7, longitude: 121.5 }));

        expect(parseCollectionSubmission(place, form)).toEqual({
            success: true,
            values: {
                title: "Shanghai",
                location: { latitude: 31.23, longitude: 121.47 },
                home: { latitude: 30.7, longitude: 121.5 }
            }
        });
    });

    it("round-trips through Revision format v2 with codec 2", async () => {
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
        const appended = await revisions.append(stored.id, entryRevisionSnapshot(place, stored, ["tag-1"]));
        const raw = await env.DB.prepare("SELECT format_version, snapshot FROM _jamcaa_place_revision WHERE id = ?")
            .bind(appended.id)
            .first<{ format_version: number; snapshot: string }>();

        expect(raw?.format_version).toBe(2);
        const encoded = JSON.parse(raw!.snapshot) as { fields: Record<string, unknown> };

        expect(encoded.fields.location).toEqual({
            $field: { kind: "@test/geo-point", codec: 2, value: { latitude: 31.23, longitude: 121.47 } }
        });
        await expect(revisions.byId(stored.id, appended.id)).resolves.toMatchObject({
            snapshot: { fields: { location: { latitude: 31.23, longitude: 121.47 } } }
        });
    });

    it("refuses a Revision envelope with an unknown codec", async () => {
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
                "old-codec",
                stored.id,
                2,
                JSON.stringify({
                    slug: "guarded",
                    status: "draft",
                    publishedAt: null,
                    categoryId: "category-1",
                    fields: {
                        title: { $field: { kind: "text", codec: 1, value: "Guarded" } },
                        location: {
                            $field: { kind: "@test/geo-point", codec: 1, value: { latitude: 1, longitude: 2 } }
                        },
                        home: null
                    },
                    tagIds: []
                }),
                Date.now()
            )
            .run();

        await expect(revisions.byId(stored.id, "old-codec")).rejects.toThrow(/codec 1 is not known/);
    });

    it("projects compound Search text for runtime and SQLite alike", () => {
        expect(
            searchProjection(place, { title: "Shanghai", location__latitude: 31.23, location__longitude: 121.47 })
        ).toEqual(["Shanghai", "31.23 121.47"]);
        expect(searchProjectionSql(place, "entry")).toEqual([
            "coalesce(entry.\"title\", '')",
            "coalesce(entry.\"location__latitude\", '') || ' ' || coalesce(entry.\"location__longitude\", '')"
        ]);
    });

    it("describes both columns in the Search artifact", () => {
        const descriptor = searchArtifactDescriptor(place);
        const location = descriptor.fields.find(field => field.name === "location");

        expect(location).toEqual({
            name: "location",
            kind: "@test/geo-point",
            storageVersion: 1,
            searchVersion: 1,
            columns: ["location__latitude", "location__longitude"],
            expression: { type: "columns-text", slots: ["latitude", "longitude"] }
        });
    });

    it("rebuilds compound values in public Summaries", async () => {
        const store = entryStore({ database: database(), collection: place, table });

        await env.DB.prepare("DELETE FROM place").run();
        await store.create({
            slug: "listed",
            authorId: "author-1",
            categoryId: "category-1",
            status: "published",
            title: "Listed",
            location: { latitude: 31.23, longitude: 121.47 },
            home: { latitude: 30.7, longitude: 121.5 }
        });

        const reader = entrySummaryReader({ database: database(), model, collection: place });
        const page = await reader.list();

        expect(page.summaries).toHaveLength(1);
        expect(page.summaries[0]).toMatchObject({ title: "Listed", location: { latitude: 31.23, longitude: 121.47 } });
    });
});

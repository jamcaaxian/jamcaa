import { env } from "cloudflare:test";
import { getTableConfig, real as sqliteReal } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../db/client";
import { defineCollection } from "./collection";
import { declaredFieldStorage, entryStore } from "./entries";
import { compileField, slot } from "./field-capsule";
import { canonicalFieldValue } from "./field-values";
import { decodePhysicalCells, physicalLayout } from "./field-layout";
import { text, type Field } from "./fields";
import { defineContentModel } from "./model";
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
            submissionValue: raw => JSON.parse(raw) as unknown,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined
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

function database() {
    return createDatabase(env.DB);
}

beforeAll(async () => {
    await env.DB.prepare(createPlaceTable).run();
});

afterAll(async () => {
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

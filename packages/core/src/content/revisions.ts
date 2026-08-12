import { and, desc, eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import {
    check,
    foreignKey,
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
    type SQLiteTable
} from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import type { Collection, EntryOf } from "./collection";
import { declaredValues, type DeclaredValuesOf } from "./entries";
import { fieldSnapshotValue, fieldValueFromSnapshot } from "./field-values";
import type { EntryStatus } from "./system-fields";

export function buildRevisionTable(collectionName: string, entryTable: SQLiteTable) {
    const entryId = getTableColumns(entryTable).id;

    if (entryId === undefined) {
        throw new Error(`Collection "${collectionName}" has no Entry identifier.`);
    }

    return sqliteTable(
        `_jamcaa_${collectionName}_revision`,
        {
            ordinal: integer("ordinal").primaryKey({ autoIncrement: true }),
            id: text("id").notNull(),
            entryId: text("entry_id").notNull(),
            formatVersion: integer("format_version").notNull().default(1),
            snapshot: text("snapshot").notNull(),
            createdAt: integer("created_at", { mode: "timestamp_ms" })
                .notNull()
                .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        },
        table => [
            foreignKey({ columns: [table.entryId], foreignColumns: [entryId] }).onDelete("cascade"),
            uniqueIndex(`_jamcaa_${collectionName}_revision_id_key`).on(table.id),
            index(`_jamcaa_${collectionName}_revision_entry_order_idx`).on(table.entryId, table.ordinal),
            check(`_jamcaa_${collectionName}_revision_snapshot_json`, sql`json_valid(${table.snapshot})`)
        ]
    );
}

export interface Revision<TSnapshot> {
    id: string;
    entryId: string;
    formatVersion: number;
    snapshot: TSnapshot;
    createdAt: Date;
}

export interface RevisionStore<TSnapshot> {
    append(entryId: string, snapshot: TSnapshot): Promise<Revision<TSnapshot>>;
    prepareAppend(
        entryId: string,
        snapshot: TSnapshot
    ): { revision: Revision<TSnapshot>; statement: D1PreparedStatement };
    list(entryId: string): Promise<Revision<TSnapshot>[]>;
    byId(entryId: string, revisionId: string): Promise<Revision<TSnapshot> | undefined>;
}

interface RevisionCodec<TSnapshot> {
    encode(snapshot: TSnapshot): unknown;
    decode(snapshot: unknown): TSnapshot;
}

export interface EntryRevisionSnapshot<TCollection extends Collection> {
    slug: string;
    status: EntryStatus;
    publishedAt: number | null;
    categoryId: string;
    fields: DeclaredValuesOf<TCollection>;
    tagIds: string[];
}

export function entryRevisionSnapshot<TCollection extends Collection>(
    collection: TCollection,
    entry: EntryOf<TCollection>,
    tagIds: readonly string[]
): EntryRevisionSnapshot<TCollection> {
    return {
        slug: entry.slug,
        status: entry.status,
        publishedAt: entry.publishedAt?.getTime() ?? null,
        categoryId: entry.categoryId,
        fields: declaredValues(collection, entry),
        tagIds: [...new Set(tagIds)].sort()
    };
}

export function revisionStore<TSnapshot>(
    database: Database,
    table: ReturnType<typeof buildRevisionTable>,
    codec: RevisionCodec<TSnapshot> = { encode: snapshot => snapshot, decode: snapshot => snapshot as TSnapshot }
): RevisionStore<TSnapshot> {
    const tableName = `"${getTableName(table).replaceAll('"', '""')}"`;

    function parse(row: typeof table.$inferSelect): Revision<TSnapshot> {
        return {
            id: row.id,
            entryId: row.entryId,
            formatVersion: row.formatVersion,
            snapshot: codec.decode(JSON.parse(row.snapshot) as unknown),
            createdAt: row.createdAt
        };
    }

    async function byId(entryId: string, revisionId: string): Promise<Revision<TSnapshot> | undefined> {
        const rows = await database
            .select()
            .from(table)
            .where(and(eq(table.entryId, entryId), eq(table.id, revisionId)))
            .limit(1);

        return rows[0] === undefined ? undefined : parse(rows[0]);
    }

    function prepareAppend(entryId: string, snapshot: TSnapshot) {
        const id = crypto.randomUUID();
        const createdAt = new Date();
        const revision = { id, entryId, formatVersion: 1, snapshot, createdAt };
        const statement = database.$client
            .prepare(
                `INSERT INTO ${tableName} `
                    + "(id, entry_id, format_version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(id, entryId, revision.formatVersion, JSON.stringify(codec.encode(snapshot)), createdAt.getTime());

        return { revision, statement };
    }

    return {
        async append(entryId, snapshot) {
            const prepared = prepareAppend(entryId, snapshot);

            await prepared.statement.run();
            return prepared.revision;
        },

        prepareAppend,

        async list(entryId) {
            const rows = await database
                .select()
                .from(table)
                .where(eq(table.entryId, entryId))
                .orderBy(desc(table.ordinal));

            return rows.map(parse);
        },

        byId
    };
}

export function entryRevisionStore<TCollection extends Collection>(options: {
    database: Database;
    table: ReturnType<typeof buildRevisionTable>;
    collection: TCollection;
}): RevisionStore<EntryRevisionSnapshot<TCollection>> {
    const { collection, database, table } = options;

    return revisionStore(database, table, {
        encode(snapshot) {
            const fields: Record<string, unknown> = {};

            for (const [fieldName, field] of Object.entries(collection.fields)) {
                fields[fieldName] = fieldSnapshotValue(field, snapshot.fields[fieldName]);
            }

            return { ...snapshot, fields };
        },
        decode(value) {
            if (typeof value !== "object" || value === null) {
                throw new Error("The Revision snapshot is not an object.");
            }

            const snapshot = value as Record<string, unknown>;
            const encodedFields = snapshot.fields;

            if (typeof encodedFields !== "object" || encodedFields === null) {
                throw new Error("The Revision snapshot has no declared Fields.");
            }

            const fields: Record<string, unknown> = {};

            for (const [fieldName, field] of Object.entries(collection.fields)) {
                if (!(fieldName in encodedFields)) {
                    if (field.required) {
                        throw new Error(`The Revision snapshot is missing the required Field "${fieldName}".`);
                    }

                    fields[fieldName] = null;
                    continue;
                }

                fields[fieldName] = fieldValueFromSnapshot(
                    field,
                    (encodedFields as Record<string, unknown>)[fieldName]
                );
            }

            return { ...snapshot, fields } as unknown as EntryRevisionSnapshot<TCollection>;
        }
    });
}

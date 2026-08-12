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
import { capsuleOf } from "./field-capsule";
import { canonicalFieldValue, fieldValueFromSnapshot } from "./field-values";
import type { EntryStatus } from "./system-fields";

/** Revisions written from now on carry per-Field codec envelopes. */
const REVISION_FORMAT_VERSION = 2;

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
    decode(snapshot: unknown, formatVersion: number): TSnapshot;
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
            snapshot: codec.decode(JSON.parse(row.snapshot) as unknown, row.formatVersion),
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
        const revision = { id, entryId, formatVersion: REVISION_FORMAT_VERSION, snapshot, createdAt };
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
                const canonical = canonicalFieldValue(field, snapshot.fields[fieldName]);

                fields[fieldName] =
                    canonical === null ? null : (
                        {
                            $field: {
                                kind: field.kind,
                                codec: capsuleOf(field).revisionVersion(),
                                value: capsuleOf(field).revisionEncode(canonical as never)
                            }
                        }
                    );
            }

            return { ...snapshot, fields };
        },
        decode(value, formatVersion) {
            if (typeof value !== "object" || value === null) {
                throw new Error("The Revision snapshot is not an object.");
            }

            const snapshot = value as Record<string, unknown>;
            const encodedFields = snapshot.fields;

            if (typeof encodedFields !== "object" || encodedFields === null) {
                throw new Error("The Revision snapshot has no declared Fields.");
            }

            if (formatVersion !== 1 && formatVersion !== 2) {
                throw new Error(`The Revision snapshot format version ${formatVersion} is not known.`);
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

                const raw = (encodedFields as Record<string, unknown>)[fieldName];

                if (formatVersion === 1) {
                    fields[fieldName] = fieldValueFromSnapshot(field, raw);
                    continue;
                }

                if (raw === null) {
                    fields[fieldName] = canonicalFieldValue(field, null);
                    continue;
                }

                const coded =
                    typeof raw === "object" && raw !== null ?
                        ((raw as Record<string, unknown>).$field as Record<string, unknown> | null | undefined)
                    :   undefined;

                if (typeof coded !== "object" || coded === null) {
                    throw new Error(`The Revision snapshot Field "${fieldName}" has no codec envelope.`);
                }

                if (coded.kind !== field.kind) {
                    throw new Error(
                        `The Revision snapshot Field "${fieldName}" belongs to ${String(coded.kind)} rather than ${field.kind}.`
                    );
                }

                if (typeof coded.codec !== "number") {
                    throw new Error(`The Revision snapshot Field "${fieldName}" has no codec version.`);
                }

                fields[fieldName] = canonicalFieldValue(
                    field,
                    capsuleOf(field).revisionDecode(coded.codec, coded.value)
                );
            }

            return { ...snapshot, fields } as unknown as EntryRevisionSnapshot<TCollection>;
        }
    });
}

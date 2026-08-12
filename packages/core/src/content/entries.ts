import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import type { Collection, EntryOf, FieldMap } from "./collection";
import { capsuleOf, type SQLiteCell } from "./field-capsule";
import { canonicalFieldValue } from "./field-values";
import { decodePhysicalCells, physicalLayout } from "./field-layout";
import type { FieldValue } from "./fields";
import type { EntryStatus } from "./system-fields";

type RequiredNames<TFields extends FieldMap> = {
    [TName in keyof TFields]: null extends FieldValue<TFields[TName]> ? never : TName;
}[keyof TFields];

type OptionalNames<TFields extends FieldMap> = Exclude<keyof TFields, RequiredNames<TFields>>;

type DeclaredValues<TFields extends FieldMap> = { [TName in RequiredNames<TFields>]: FieldValue<TFields[TName]> } & {
    [TName in OptionalNames<TFields>]?: FieldValue<TFields[TName]>;
};

export type DeclaredValuesOf<TCollection extends Collection> = {
    [TName in keyof TCollection["fields"]]: FieldValue<TCollection["fields"][TName]>;
};

export type NewEntry<TFields extends FieldMap> = {
    slug: string;
    authorId: string;
    categoryId: string;
    status?: EntryStatus;
    publishedAt?: Date | null;
} & DeclaredValues<TFields>;

export type EntryChanges<TFields extends FieldMap> = Partial<NewEntry<TFields>>;

export interface EntryQuery {
    status?: EntryStatus;
    categoryId?: string;
    tagId?: string;
    limit?: number;
    offset?: number;
}

export interface EntryStore<TFields extends FieldMap> {
    create(entry: NewEntry<TFields>): Promise<EntryOf<Collection<TFields>>>;
    update(id: string, changes: EntryChanges<TFields>): Promise<void>;
    remove(id: string): Promise<void>;
    byId(id: string): Promise<EntryOf<Collection<TFields>> | undefined>;
    /** Preserves requested order and omits identifiers that no longer exist. */
    byIds(ids: readonly string[]): Promise<EntryOf<Collection<TFields>>[]>;
    bySlug(slug: string): Promise<EntryOf<Collection<TFields>> | undefined>;
    list(query?: EntryQuery): Promise<EntryOf<Collection<TFields>>[]>;
}

export interface DeclaredFieldStorage {
    columns: string;
    placeholders: string;
    assignments: string;
    bindings: readonly (string | number | Uint8Array | null)[];
}

function quoted(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
}

export function declaredValues<TCollection extends Collection>(
    collection: TCollection,
    source: Readonly<Record<string, unknown>>
): DeclaredValuesOf<TCollection> {
    const values: Record<string, unknown> = {};

    for (const [fieldName, field] of Object.entries(collection.fields)) {
        if (!(fieldName in source)) {
            throw new Error(`The Entry is missing its declared Field "${fieldName}".`);
        }

        values[fieldName] = canonicalFieldValue(field, source[fieldName]);
    }

    return values as DeclaredValuesOf<TCollection>;
}

export function declaredFieldStorage<TCollection extends Collection>(
    collection: TCollection,
    source: DeclaredValuesOf<TCollection>
): DeclaredFieldStorage {
    const layout = physicalLayout(collection.name, collection.fields);
    const values = declaredValues(collection, source);
    const columns: string[] = [];
    const bindings: (string | number | Uint8Array | null)[] = [];

    for (const item of layout.fields) {
        const field = collection.fields[item.fieldName]!;
        const canonical = values[item.fieldName];

        columns.push(...item.columns.map(column => quoted(column)));

        if (canonical === null) {
            bindings.push(...item.slotNames.map(() => null));
        } else {
            const encoded = capsuleOf(field).encode(canonical as never);

            bindings.push(...item.slotNames.map(slotName => encoded[slotName] ?? null));
        }
    }

    return {
        columns: columns.join(", "),
        placeholders: columns.map(() => "?").join(", "),
        assignments: columns.map(column => `${column} = ?`).join(", "),
        bindings
    };
}

function columnNamed(table: SQLiteTable, name: string): SQLiteColumn {
    const column = getTableColumns(table)[name];

    if (column === undefined) {
        throw new Error(`The table has no column "${name}", which should be impossible.`);
    }

    return column;
}

/**
 * The typed way to read and write a collection's entries. The assembled table is
 * loose to Drizzle (ADR-0018), so this is where a declaration's types are put back:
 * callers see `EntryOf`, and never the untyped columns underneath.
 */
export function entryStore<TFields extends FieldMap>(options: {
    database: Database;
    collection: Collection<TFields>;
    table: SQLiteTable;
    tagTable?: SQLiteTable;
}): EntryStore<TFields> {
    const { database, collection, table, tagTable } = options;
    const layout = physicalLayout(collection.name, collection.fields);

    type Entry = EntryOf<Collection<TFields>>;

    function parseDeclaredValues(values: Record<string, unknown>) {
        const parsed = { ...values };

        for (const [fieldName, field] of Object.entries(collection.fields)) {
            const item = layout.byField[fieldName]!;

            if (item.keys.length === 1 && item.keys[0] === fieldName) {
                if (fieldName in values) {
                    parsed[fieldName] = canonicalFieldValue(field, values[fieldName]);
                }

                continue;
            }

            const cells: Record<string, SQLiteCell> = {};
            let present = true;

            for (let index = 0; index < item.slotNames.length; index += 1) {
                const key = item.keys[index]!;

                if (!(key in values)) {
                    present = false;
                    break;
                }

                cells[item.slotNames[index]!] = values[key] as SQLiteCell;
            }

            if (present) {
                parsed[fieldName] = canonicalFieldValue(field, decodePhysicalCells(field, cells));

                for (const key of item.keys) {
                    delete parsed[key];
                }
            }
        }

        return parsed;
    }

    /** Spreads one logical value into the physical slot keys a write needs. */
    function physicalValues(entry: Record<string, unknown>) {
        const result = { ...entry };

        for (const [fieldName, field] of Object.entries(collection.fields)) {
            const item = layout.byField[fieldName]!;

            if (item.keys.length === 1 && item.keys[0] === fieldName) {
                if (fieldName in result) {
                    result[fieldName] = canonicalFieldValue(field, result[fieldName]);
                }

                continue;
            }

            if (!(fieldName in result)) {
                continue;
            }

            const canonical = canonicalFieldValue(field, result[fieldName]);
            const encoded =
                canonical === null ?
                    Object.fromEntries(item.slotNames.map(slotName => [slotName, null]))
                :   capsuleOf(field).encode(canonical as never);

            delete result[fieldName];

            for (const slotName of item.slotNames) {
                result[`${fieldName}__${slotName}`] = encoded[slotName] ?? null;
            }
        }

        return result;
    }

    const asEntries = (rows: Record<string, unknown>[]) => rows.map(parseDeclaredValues) as Entry[];

    async function one(where: ReturnType<typeof eq>): Promise<Entry | undefined> {
        const rows = await database.select().from(table).where(where).limit(1);

        return asEntries(rows)[0];
    }

    return {
        async create(entry) {
            const id = crypto.randomUUID();

            await database.insert(table).values({ ...physicalValues(entry), id });

            const created = await one(eq(columnNamed(table, "id"), id));

            if (created === undefined) {
                throw new Error("The entry was written but could not be read back.");
            }

            return created;
        },

        async update(id, changes) {
            await database
                .update(table)
                .set({ ...physicalValues(changes), updatedAt: new Date() })
                .where(eq(columnNamed(table, "id"), id));
        },

        async remove(id) {
            await database.delete(table).where(eq(columnNamed(table, "id"), id));
        },

        byId: id => one(eq(columnNamed(table, "id"), id)),

        async byIds(ids) {
            if (ids.length === 0) {
                return [];
            }

            const unique = [...new Set(ids)];
            const found: Entry[] = [];

            for (let start = 0; start < unique.length; start += 50) {
                const batch = unique.slice(start, start + 50);
                const rows = await database
                    .select()
                    .from(table)
                    .where(inArray(columnNamed(table, "id"), batch));

                found.push(...asEntries(rows));
            }

            const byId = new Map(found.map(entry => [entry.id, entry]));
            const ordered: Entry[] = [];

            for (const id of ids) {
                const entry = byId.get(id);

                if (entry !== undefined) {
                    ordered.push(entry);
                }
            }

            return ordered;
        },

        bySlug: slug => one(eq(columnNamed(table, "slug"), slug)),

        async list(query = {}) {
            const conditions = [];

            if (query.status !== undefined) {
                conditions.push(eq(columnNamed(table, "status"), query.status));
            }

            if (query.categoryId !== undefined) {
                conditions.push(eq(columnNamed(table, "categoryId"), query.categoryId));
            }

            if (query.tagId !== undefined) {
                if (tagTable === undefined) {
                    throw new Error(`Collection "${collection.name}" has no Tag relation table.`);
                }

                conditions.push(
                    sql`EXISTS (
                        SELECT 1
                        FROM ${tagTable}
                        WHERE ${columnNamed(tagTable, "entryId")} = ${columnNamed(table, "id")}
                          AND ${columnNamed(tagTable, "tagId")} = ${query.tagId}
                    )`
                );
            }

            const rows = await database
                .select()
                .from(table)
                .where(conditions.length > 0 ? and(...conditions) : sql`1 = 1`)
                .orderBy(desc(columnNamed(table, "createdAt")))
                .limit(query.limit ?? 50)
                .offset(query.offset ?? 0);

            return asEntries(rows);
        }
    };
}

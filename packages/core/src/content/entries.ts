import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import type { Collection, EntryOf, FieldMap } from "./collection";
import type { FieldValue } from "./fields";
import type { EntryStatus } from "./system-fields";

type RequiredNames<TFields extends FieldMap> = {
    [TName in keyof TFields]: null extends FieldValue<TFields[TName]> ? never : TName;
}[keyof TFields];

type OptionalNames<TFields extends FieldMap> = Exclude<keyof TFields, RequiredNames<TFields>>;

type DeclaredValues<TFields extends FieldMap> = { [TName in RequiredNames<TFields>]: FieldValue<TFields[TName]> } & {
    [TName in OptionalNames<TFields>]?: FieldValue<TFields[TName]>;
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
    bySlug(slug: string): Promise<EntryOf<Collection<TFields>> | undefined>;
    list(query?: EntryQuery): Promise<EntryOf<Collection<TFields>>[]>;
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

    type Entry = EntryOf<Collection<TFields>>;

    function parseDeclaredValues(values: Record<string, unknown>) {
        const parsed = { ...values };

        for (const [fieldName, field] of Object.entries(collection.fields)) {
            if (!(fieldName in values) || values[fieldName] === null || field.parse === undefined) {
                continue;
            }

            parsed[fieldName] = field.parse(values[fieldName]);
        }

        return parsed;
    }

    const asEntries = (rows: Record<string, unknown>[]) => rows.map(parseDeclaredValues) as Entry[];

    async function one(where: ReturnType<typeof eq>): Promise<Entry | undefined> {
        const rows = await database.select().from(table).where(where).limit(1);

        return asEntries(rows)[0];
    }

    return {
        async create(entry) {
            const id = crypto.randomUUID();

            await database.insert(table).values({ ...parseDeclaredValues(entry), id });

            const created = await one(eq(columnNamed(table, "id"), id));

            if (created === undefined) {
                throw new Error("The entry was written but could not be read back.");
            }

            return created;
        },

        async update(id, changes) {
            await database
                .update(table)
                .set({ ...parseDeclaredValues(changes), updatedAt: new Date() })
                .where(eq(columnNamed(table, "id"), id));
        },

        async remove(id) {
            await database.delete(table).where(eq(columnNamed(table, "id"), id));
        },

        byId: id => one(eq(columnNamed(table, "id"), id)),

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

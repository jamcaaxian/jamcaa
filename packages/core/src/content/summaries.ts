import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import type { Collection, EntryOf } from "./collection";
import type { ContentModel } from "./model";
import type { SystemFields } from "./system-fields";

type SummaryField<TCollection extends Collection> =
    NonNullable<TCollection["summary"]>["fields"][number] extends infer TName ?
        Extract<TName, keyof EntryOf<TCollection>>
    :   never;

export type EntrySummaryOf<TCollection extends Collection> = Readonly<
    Omit<SystemFields, "status"> & { status: "published" } & Pick<EntryOf<TCollection>, SummaryField<TCollection>>
>;

export interface EntrySummaryQuery {
    categoryId?: string;
    tagId?: string;
    limit?: number;
}

export interface EntrySummaryPage<TCollection extends Collection> {
    summaries: EntrySummaryOf<TCollection>[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function summaryLimit(limit: number | undefined): number {
    if (limit === undefined) {
        return DEFAULT_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error(`Entry Summary limit must be an integer from 1 to ${MAX_LIMIT}.`);
    }

    return limit;
}

function columnNamed(table: SQLiteTable, name: string): SQLiteColumn {
    const column = getTableColumns(table)[name];

    if (column === undefined) {
        throw new Error(`The table has no column "${name}", which should be impossible.`);
    }

    return column;
}

export interface EntrySummaryReader<TCollection extends Collection> {
    list(query?: EntrySummaryQuery): Promise<EntrySummaryPage<TCollection>>;
}

export function entrySummaryReader<TCollection extends Collection>(options: {
    database: Database;
    model: ContentModel;
    collection: TCollection;
}): EntrySummaryReader<TCollection> {
    const { database, model, collection } = options;
    const table = model.table(collection.name);
    const tagTable = model.tagTable(collection.name);

    if (collection.summary === undefined) {
        throw new Error(`Collection "${collection.name}" has no Entry Summary declaration.`);
    }

    if (model.collection(collection.name) !== collection || table === undefined || tagTable === undefined) {
        throw new Error(`Collection "${collection.name}" does not belong to this content model.`);
    }

    const systemFields = [
        "id",
        "slug",
        "status",
        "authorId",
        "categoryId",
        "createdAt",
        "updatedAt",
        "publishedAt"
    ] as const;
    const selected = Object.fromEntries(
        [...systemFields, ...collection.summary.fields].map(fieldName => [fieldName, columnNamed(table, fieldName)])
    );

    return {
        async list(query = {}) {
            const conditions = [eq(columnNamed(table, "status"), "published")];

            if (query.categoryId !== undefined) {
                conditions.push(eq(columnNamed(table, "categoryId"), query.categoryId));
            }

            if (query.tagId !== undefined) {
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
                .select(selected)
                .from(table)
                .where(and(...conditions))
                .orderBy(
                    desc(sql`coalesce(${columnNamed(table, "publishedAt")}, ${columnNamed(table, "createdAt")})`),
                    desc(columnNamed(table, "id"))
                )
                .limit(summaryLimit(query.limit));

            return { summaries: rows as EntrySummaryOf<TCollection>[] };
        }
    };
}

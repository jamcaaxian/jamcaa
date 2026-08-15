import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import { canonicalLocale, type LocaleCatalogue } from "../i18n";
import type { Collection, EntryOf } from "./collection";
import { type SQLiteCell } from "./field-capsule";
import { canonicalFieldValue } from "./field-values";
import { decodePhysicalCells, physicalLayout } from "./field-layout";
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
    locale?: string;
    limit?: number;
    cursor?: string;
}

export interface EntrySummaryPage<TCollection extends Collection> {
    summaries: EntrySummaryOf<TCollection>[];
    nextCursor?: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface SummaryCursor {
    publishedAt: number;
    id: string;
    locale?: string;
}

function cursorProblem(): never {
    throw new Error("The Entry Summary cursor is invalid.");
}

function base64Url(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
        cursorProblem();
    }

    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);

    return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

export function encodeEntrySummaryCursor(cursor: SummaryCursor): string {
    if (!Number.isSafeInteger(cursor.publishedAt) || cursor.id.length === 0) {
        cursorProblem();
    }

    return base64Url(
        JSON.stringify(
            cursor.locale === undefined ?
                { v: 1, p: cursor.publishedAt, i: cursor.id }
            :   { v: 2, p: cursor.publishedAt, i: cursor.id, l: canonicalLocale(cursor.locale) }
        )
    );
}

export function decodeEntrySummaryCursor(cursor: string | undefined): SummaryCursor | undefined {
    if (cursor === undefined) {
        return undefined;
    }

    try {
        const value = JSON.parse(fromBase64Url(cursor)) as Record<string, unknown>;

        if (
            ![1, 2].includes(value.v as number)
            || typeof value.p !== "number"
            || !Number.isSafeInteger(value.p)
            || typeof value.i !== "string"
            || value.i.length === 0
            || (value.v === 2 && typeof value.l !== "string")
        ) {
            cursorProblem();
        }

        return {
            publishedAt: value.p as number,
            id: value.i as string,
            ...(value.v === 2 ? { locale: canonicalLocale(value.l as string) } : {})
        };
    } catch (error) {
        if (error instanceof Error && error.message === "The Entry Summary cursor is invalid.") {
            throw error;
        }

        cursorProblem();
    }
}

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
    locales?: LocaleCatalogue;
}): EntrySummaryReader<TCollection> {
    const { database, model, collection, locales } = options;
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
        "locale",
        "translationId",
        "slug",
        "status",
        "authorId",
        "categoryId",
        "createdAt",
        "updatedAt",
        "publishedAt"
    ] as const;
    const summaryFields = collection.summary.fields;
    const layout = physicalLayout(collection.name, collection.fields);
    const selectedEntries: [string, SQLiteColumn][] = systemFields.map(fieldName => [
        fieldName,
        columnNamed(table, fieldName)
    ]);

    for (const fieldName of summaryFields) {
        const item = layout.byField[fieldName]!;

        for (const key of item.keys) {
            selectedEntries.push([key, columnNamed(table, key)]);
        }
    }

    const selected = Object.fromEntries(selectedEntries);

    return {
        async list(query = {}) {
            const limit = summaryLimit(query.limit);
            const cursor = decodeEntrySummaryCursor(query.cursor);
            const locale =
                query.locale === undefined ?
                    locales?.defaultLocale
                :   (locales?.canonical(query.locale) ?? canonicalLocale(query.locale));

            if (query.locale !== undefined && locales !== undefined && locales.canonical(query.locale) === undefined) {
                throw new Error(`Locale "${query.locale}" is not supported by this Site.`);
            }

            if (cursor !== undefined && cursor.locale !== locale) {
                cursorProblem();
            }

            const publicationMoment = sql`coalesce(${columnNamed(table, "publishedAt")}, ${columnNamed(table, "createdAt")})`;
            const conditions = [eq(columnNamed(table, "status"), "published")];

            if (locale !== undefined) {
                conditions.push(eq(columnNamed(table, "locale"), locale));
            }

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

            if (cursor !== undefined) {
                conditions.push(
                    sql`(${publicationMoment} < ${cursor.publishedAt}
                        OR (${publicationMoment} = ${cursor.publishedAt} AND ${columnNamed(table, "id")} < ${cursor.id}))`
                );
            }

            const rows = await database
                .select(selected)
                .from(table)
                .where(and(...conditions))
                .orderBy(desc(publicationMoment), desc(columnNamed(table, "id")))
                .limit(limit + 1);

            const page = rows.slice(0, limit).map(row => {
                const parsed: Record<string, unknown> = { ...row };

                for (const fieldName of summaryFields) {
                    const item = layout.byField[fieldName]!;

                    if (item.keys.length === 1 && item.keys[0] === fieldName) {
                        continue;
                    }

                    const cells: Record<string, SQLiteCell> = {};

                    for (let index = 0; index < item.slotNames.length; index += 1) {
                        cells[item.slotNames[index]!] = row[item.keys[index]!] as SQLiteCell;
                    }

                    parsed[fieldName] = canonicalFieldValue(
                        collection.fields[fieldName]!,
                        decodePhysicalCells(collection.fields[fieldName]!, cells)
                    );

                    for (const key of item.keys) {
                        delete parsed[key];
                    }
                }

                return parsed;
            }) as EntrySummaryOf<TCollection>[];
            const last = page.at(-1);

            return {
                summaries: page,
                nextCursor:
                    rows.length > limit && last !== undefined ?
                        encodeEntrySummaryCursor({
                            publishedAt: (last.publishedAt ?? last.createdAt).getTime(),
                            id: last.id,
                            ...(locale === undefined ? {} : { locale })
                        })
                    :   undefined
            };
        }
    };
}

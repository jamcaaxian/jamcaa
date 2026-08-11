import { getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import { decodeSearchCursor, encodeSearchCursor, literalSearchQuery, searchLimit } from "./query";
import { searchTableName } from "./migration";
import type { SearchPage, SearchPort, SearchRequest } from "./port";

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

interface SearchRow {
    entryId: string;
    excerpt: string;
    rank: number;
    rowId: number;
}

export function d1SearchAdapter(options: {
    database: Database;
    tableFor(collectionName: string): SQLiteTable | undefined;
    tagTableFor(collectionName: string): SQLiteTable | undefined;
}): SearchPort {
    const { database, tableFor, tagTableFor } = options;

    return {
        async search(request: SearchRequest): Promise<SearchPage> {
            const query = literalSearchQuery(request.query);

            if (query === undefined) {
                return { matches: [] };
            }

            const limit = searchLimit(request.limit);
            const cursor = decodeSearchCursor(request.cursor);
            const entryTableDefinition = tableFor(request.collection.name);

            if (entryTableDefinition === undefined) {
                throw new Error(`Collection "${request.collection.name}" has no Entry table.`);
            }

            const ftsName = searchTableName(request.collection);
            const ftsTable = quoteIdentifier(ftsName);
            const entryTable = quoteIdentifier(getTableName(entryTableDefinition));
            const conditions = [`${ftsTable} MATCH ?`, `entry.status = 'published'`];
            const bindings: unknown[] = [query];

            if (request.filters?.categoryId !== undefined) {
                conditions.push("entry.category_id = ?");
                bindings.push(request.filters.categoryId);
            }

            if (request.filters?.tagId !== undefined) {
                const tagTableDefinition = tagTableFor(request.collection.name);

                if (tagTableDefinition === undefined) {
                    throw new Error(`Collection "${request.collection.name}" has no Tag relation table.`);
                }

                const tagTable = quoteIdentifier(getTableName(tagTableDefinition));
                conditions.push(`EXISTS (
                    SELECT 1
                    FROM ${tagTable} AS membership
                    WHERE membership.entry_id = entry.id
                      AND membership.tag_id = ?
                )`);
                bindings.push(request.filters.tagId);
            }

            if (cursor !== undefined) {
                conditions.push(`(${ftsTable}.rank > ? OR (${ftsTable}.rank = ? AND ${ftsTable}.rowid > ?))`);
                bindings.push(cursor.rank, cursor.rank, cursor.rowId);
            }

            const rows = await database.$client
                .prepare(
                    `
                    SELECT
                        ${ftsTable}.entry_id AS entryId,
                        snippet(${ftsTable}, -1, '', '', '…', 32) AS excerpt,
                        ${ftsTable}.rank AS rank,
                        ${ftsTable}.rowid AS rowId
                    FROM ${ftsTable}
                    INNER JOIN ${entryTable} AS entry ON entry.rowid = ${ftsTable}.rowid
                    WHERE ${conditions.join("\n                      AND ")}
                    ORDER BY ${ftsTable}.rank ASC, ${ftsTable}.rowid ASC
                    LIMIT ?
                `
                )
                .bind(...bindings, limit + 1)
                .all<SearchRow>();

            const pageRows = rows.results.slice(0, limit);
            const finalRow = pageRows.at(-1);

            return {
                matches: pageRows.map(row => ({ entryId: row.entryId, excerpt: row.excerpt })),
                nextCursor:
                    rows.results.length > limit && finalRow !== undefined ?
                        encodeSearchCursor({ rank: finalRow.rank, rowId: finalRow.rowId })
                    :   undefined
            };
        }
    };
}

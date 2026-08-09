import { sqliteTable, uniqueIndex, type SQLiteColumnBuilderBase } from "drizzle-orm/sqlite-core";
import type { Collection } from "./collection";
import { systemColumns } from "./system-fields";

/** Declarations are camel case; SQL columns are snake case. */
export function toColumnName(fieldName: string): string {
    return fieldName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Turns a declaration into the real table it describes. The result is deliberately
 * loose to Drizzle: a table assembled at runtime cannot carry per-column types, so
 * `EntryOf` is what application code should read an entry's shape from.
 */
export function buildTable(collection: Collection) {
    const declared: Record<string, SQLiteColumnBuilderBase> = {};

    for (const [fieldName, field] of Object.entries(collection.fields)) {
        declared[fieldName] = field.buildColumn(toColumnName(fieldName));
    }

    const columns = { ...systemColumns(), ...declared };

    return sqliteTable(collection.name, columns, table => [
        // One slug may name only one entry within a collection.
        uniqueIndex(`${collection.name}_slug_key`).on(table.slug)
    ]);
}

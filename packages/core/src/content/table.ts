import { sqliteTable, uniqueIndex, type SQLiteColumnBuilderBase } from "drizzle-orm/sqlite-core";
import type { Collection } from "./collection";
import { capsuleOf } from "./field-capsule";
import { physicalLayout } from "./field-layout";
import { systemColumns } from "./system-fields";

export { toColumnName } from "./field-layout";

/**
 * Turns a declaration into the real table it describes. The result is deliberately
 * loose to Drizzle: a table assembled at runtime cannot carry per-column types, so
 * `EntryOf` is what application code should read an entry's shape from.
 */
export function buildTable(collection: Collection) {
    const declared: Record<string, SQLiteColumnBuilderBase> = {};
    const layout = physicalLayout(collection.name, collection.fields);

    for (const item of layout.fields) {
        const field = collection.fields[item.fieldName]!;
        const slots = capsuleOf(field).slots();

        for (let index = 0; index < item.slotNames.length; index += 1) {
            const definition = slots[item.slotNames[index]!]!;
            const builder = definition.buildColumn(item.columns[index]!) as SQLiteColumnBuilderBase & {
                notNull(): SQLiteColumnBuilderBase;
            };

            // A slot is NOT NULL only when its Field is required and the slot
            // cannot be null inside a non-null logical value.
            declared[item.keys[index]!] = field.required && definition.nullable !== true ? builder.notNull() : builder;
        }
    }

    const columns = { ...systemColumns(), ...declared };

    return sqliteTable(collection.name, columns, table => [
        // One slug may name one Entry per Locale within a Collection.
        uniqueIndex(`${collection.name}_locale_slug_key`).on(table.locale, table.slug),
        // A Translation Set may contain at most one Entry for each Locale.
        uniqueIndex(`${collection.name}_translation_locale_key`).on(table.translationId, table.locale)
    ]);
}

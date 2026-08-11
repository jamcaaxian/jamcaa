import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Collection } from "./collection";
import { buildTable } from "./table";
import { buildTagRelationTable } from "./taxonomy";

export interface ContentModel<TCollections extends readonly Collection[] = readonly Collection[]> {
    readonly collections: TCollections;
    readonly tables: Readonly<Record<string, SQLiteTable>>;
    readonly tagTables: Readonly<Record<string, SQLiteTable>>;
    collection(name: string): Collection | undefined;
    table(name: string): SQLiteTable | undefined;
    tagTable(name: string): SQLiteTable | undefined;
}

/**
 * Assembles a site's collections and checks what a single declaration cannot:
 * that names are unique and that every reference points at something real.
 */
export function defineContentModel<const TCollections extends readonly Collection[]>(
    collections: TCollections
): ContentModel<TCollections> {
    const byName = new Map<string, Collection>();

    for (const collection of collections) {
        if (byName.has(collection.name)) {
            throw new Error(`Two collections are both named "${collection.name}".`);
        }

        byName.set(collection.name, collection);
    }

    for (const collection of collections) {
        for (const [fieldName, field] of Object.entries(collection.fields)) {
            if (field.references !== undefined && !byName.has(field.references)) {
                throw new Error(
                    `Collection "${collection.name}": the field "${fieldName}" points at `
                        + `"${field.references}", which no collection declares.`
                );
            }
        }
    }

    const tables: Record<string, SQLiteTable> = {};
    const tagTables: Record<string, SQLiteTable> = {};

    for (const collection of collections) {
        const table = buildTable(collection);

        tables[collection.name] = table;
        tagTables[collection.name] = buildTagRelationTable(collection.name, table);
    }

    return {
        collections,
        tables,
        tagTables,
        collection: name => byName.get(name),
        table: name => tables[name],
        tagTable: name => tagTables[name]
    };
}

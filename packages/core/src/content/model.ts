import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Collection } from "./collection";
import { buildTable } from "./table";

export interface ContentModel {
    readonly collections: readonly Collection[];
    readonly tables: Readonly<Record<string, SQLiteTable>>;
    collection(name: string): Collection | undefined;
    table(name: string): SQLiteTable | undefined;
}

/**
 * Assembles a site's collections and checks what a single declaration cannot:
 * that names are unique and that every reference points at something real.
 */
export function defineContentModel(collections: readonly Collection[]): ContentModel {
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

    for (const collection of collections) {
        tables[collection.name] = buildTable(collection);
    }

    return { collections, tables, collection: name => byName.get(name), table: name => tables[name] };
}

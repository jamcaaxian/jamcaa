import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Collection } from "./collection";
import type { FieldType } from "./field-types";
import { validateThirdPartyKind } from "./field-types";
import { builtinFieldKinds } from "./fields";
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

export interface ContentModelDefinition<TCollections extends readonly Collection[] = readonly Collection[]> {
    readonly collections: TCollections;
    /** Third-party Field Types; built-in kinds are installed implicitly. */
    readonly fieldTypes?: readonly FieldType[];
}

/**
 * Assembles a site's collections and checks what a single declaration cannot:
 * that names are unique, that every reference points at something real, and
 * that every Field kind has an installed Field Type.
 */
export function defineContentModel<const TCollections extends readonly Collection[]>(
    definition: ContentModelDefinition<TCollections>
): ContentModel<TCollections> {
    const { collections, fieldTypes = [] } = definition;
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

    const installedKinds = new Set<string>(builtinFieldKinds);

    for (const fieldType of fieldTypes) {
        validateThirdPartyKind(fieldType.kind);

        if (installedKinds.has(fieldType.kind)) {
            throw new Error(`Two Field Types are both installed for kind "${fieldType.kind}".`);
        }

        installedKinds.add(fieldType.kind);
    }

    for (const collection of collections) {
        for (const [fieldName, field] of Object.entries(collection.fields)) {
            if (!installedKinds.has(field.kind)) {
                throw new Error(
                    `Collection "${collection.name}": the field "${fieldName}" uses kind `
                        + `"${field.kind}", which no Field Type installs.`
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

import { capsuleOf, type FieldSearchText } from "../content/field-capsule";
import type { Collection } from "../content/collection";
import { physicalLayout } from "../content/field-layout";
import { compileSearchText, evaluateSearchText } from "./expression";

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function searchFields(collection: Collection): readonly string[] {
    if (collection.search === undefined) {
        throw new Error(`Collection "${collection.name}" has no search declaration.`);
    }

    return collection.search.fields;
}

/**
 * Projects one Search text per declared Field. Values sit under the assembled
 * table's row keys, which equal the logical Field name for single-slot Fields.
 */
export function searchProjection(collection: Collection, entry: Record<string, unknown>): string[] {
    const layout = physicalLayout(collection.name, collection.fields);

    return searchFields(collection).map(fieldName => {
        const field = collection.fields[fieldName]!;
        const item = layout.byField[fieldName]!;
        const cells: Record<string, unknown> = {};

        for (let index = 0; index < item.slotNames.length; index += 1) {
            cells[item.slotNames[index]!] = entry[item.keys[index]!];
        }

        return evaluateSearchText(capsuleOf(field).searchText(), cells);
    });
}

export function searchProjectionSql(collection: Collection, tableAlias: "entry" | "new" = "entry"): string[] {
    const layout = physicalLayout(collection.name, collection.fields);

    return searchFields(collection).map(fieldName => {
        const field = collection.fields[fieldName]!;
        const item = layout.byField[fieldName]!;

        return compileSearchText(capsuleOf(field).searchText(), slot => {
            const index = item.slotNames.indexOf(slot);

            return `${tableAlias}.${quoteIdentifier(item.columns[index]!)}`;
        });
    });
}

export interface SearchFieldArtifact {
    name: string;
    kind: string;
    storageVersion: number;
    searchVersion: number;
    columns: readonly string[];
    expression: FieldSearchText;
}

export interface SearchArtifactDescriptor {
    formatVersion: 1 | 2;
    collection: string;
    partition?: "locale";
    fields: SearchFieldArtifact[];
}

/**
 * The semantic half of the Search migration handoff: what each searchable
 * Field contributes, in a deterministic JSON-stable shape. The Site hashes
 * this descriptor separately from the generated SQL.
 */
export function searchArtifactDescriptor(collection: Collection): SearchArtifactDescriptor {
    const layout = physicalLayout(collection.name, collection.fields);

    return {
        formatVersion: 2,
        collection: collection.name,
        partition: "locale",
        fields: searchFields(collection).map(fieldName => {
            const field = collection.fields[fieldName]!;
            const capsule = capsuleOf(field);
            const expression = capsule.searchText()!;
            const item = layout.byField[fieldName]!;

            return {
                name: fieldName,
                kind: field.kind,
                storageVersion: capsule.storageVersion(),
                searchVersion: capsule.searchVersion(),
                columns: item.columns,
                expression
            };
        })
    };
}

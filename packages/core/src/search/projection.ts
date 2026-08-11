import type { Collection } from "../content/collection";
import { richTextToPlainText, type RichTextDocument } from "../content/rich-text";
import { toColumnName } from "../content/table";

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

function searchFields(collection: Collection): readonly string[] {
    if (collection.search === undefined) {
        throw new Error(`Collection "${collection.name}" has no search declaration.`);
    }

    return collection.search.fields;
}

export function searchProjection(collection: Collection, entry: Record<string, unknown>): string[] {
    return searchFields(collection).map(fieldName => {
        const value = entry[fieldName];

        if (value === null || value === undefined) {
            return "";
        }

        const field = collection.fields[fieldName];

        if (field?.kind === "richText") {
            return richTextToPlainText(value as RichTextDocument);
        }

        return String(value);
    });
}

/**
 * Mirrors richTextToPlainText() for canonical ProseMirror JSON. The recursive
 * walk emits text, hard breaks, and Media alternative text in document order.
 */
function richTextSql(columnName: string, tableAlias: "entry" | "new"): string {
    const column = `${tableAlias}.${quoteIdentifier(columnName)}`;

    return `(SELECT trim(coalesce(group_concat(group_text, char(10)), ''))
        FROM (
            SELECT
                min(position) AS position,
                group_concat(piece, '') AS group_text
            FROM (
                SELECT
                    nodes.id AS position,
                    CASE
                        WHEN json_extract(nodes.value, '$.type') = 'mediaImage' THEN nodes.fullkey
                        ELSE nodes.path
                    END AS scope,
                    CASE
                        WHEN json_extract(nodes.value, '$.type') = 'text'
                            THEN coalesce(json_extract(nodes.value, '$.text'), '')
                        WHEN json_extract(nodes.value, '$.type') = 'hardBreak'
                            THEN char(10)
                        WHEN json_extract(nodes.value, '$.type') = 'mediaImage'
                            THEN coalesce(json_extract(nodes.value, '$.attrs.alt'), '')
                        ELSE ''
                    END AS piece
                FROM json_tree(${column}) AS nodes
                WHERE nodes.type = 'object'
                  AND json_extract(nodes.value, '$.type') IN ('text', 'hardBreak', 'mediaImage')
                ORDER BY nodes.id
            )
            GROUP BY scope
            ORDER BY position
        ))`;
}

export function searchProjectionSql(collection: Collection, tableAlias: "entry" | "new" = "entry"): string[] {
    return searchFields(collection).map(fieldName => {
        const field = collection.fields[fieldName];
        const columnName = toColumnName(fieldName);

        return field?.kind === "richText" ?
                richTextSql(columnName, tableAlias)
            :   `coalesce(${tableAlias}.${quoteIdentifier(columnName)}, '')`;
    });
}

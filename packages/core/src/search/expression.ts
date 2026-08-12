import type { FieldSearchText } from "../content/field-capsule";
import { richTextToPlainText, type RichTextDocument } from "../content/rich-text";

/**
 * One Search text expression drives both the runtime projection and the SQLite
 * FTS migration. The shape is closed: adding expressiveness is a deliberate
 * contract change, never ad-hoc SQL.
 */
export function evaluateSearchText(
    expression: FieldSearchText | undefined,
    cells: Readonly<Record<string, unknown>>
): string {
    if (expression === undefined) {
        throw new Error("A searchable Field needs a Search text expression.");
    }

    switch (expression.type) {
        case "column-text": {
            const value = cells[expression.slot];

            return value === null || value === undefined ? "" : String(value);
        }
        case "rich-text": {
            const value = cells[expression.slot];

            return value === null || value === undefined ? "" : richTextToPlainText(value as RichTextDocument);
        }
        default: {
            const unknown: never = expression;

            throw new Error(`Unknown Search text expression ${String(unknown)}.`);
        }
    }
}

/**
 * Mirrors richTextToPlainText() for canonical ProseMirror JSON. The recursive
 * walk emits text, hard breaks, and Media alternative text in document order.
 */
function richTextSql(column: string): string {
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

export function compileSearchText(
    expression: FieldSearchText | undefined,
    resolveColumn: (slot: string) => string
): string {
    if (expression === undefined) {
        throw new Error("A searchable Field needs a Search text expression.");
    }

    switch (expression.type) {
        case "column-text":
            return `coalesce(${resolveColumn(expression.slot)}, '')`;
        case "rich-text":
            return richTextSql(resolveColumn(expression.slot));
        default: {
            const unknown: never = expression;

            throw new Error(`Unknown Search text expression ${String(unknown)}.`);
        }
    }
}

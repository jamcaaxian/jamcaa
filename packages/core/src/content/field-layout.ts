import type { FieldMap } from "./collection";
import { capsuleOf, type SQLiteCell } from "./field-capsule";
import type { Field } from "./fields";
import { systemFieldNames } from "./system-fields";

const SLOT_NAME = /^[a-z][a-zA-Z0-9]*$/;

/** Declarations are camel case; SQL columns are snake case. */ export function toColumnName(name: string): string {
    return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export interface PhysicalFieldLayout {
    fieldName: string;
    slotNames: readonly string[];
    /** Row keys on the assembled table, same order as slotNames. */
    keys: readonly string[];
    /** SQL column names, same order as slotNames. */
    columns: readonly string[];
}

export interface PhysicalLayout {
    fields: PhysicalFieldLayout[];
    byField: Readonly<Record<string, PhysicalFieldLayout>>;
    /** System plus declared physical columns. */
    total: number;
}

function fail(collection: string, problem: string): never {
    throw new Error(`Collection "${collection}": ${problem}`);
}

/**
 * Resolves every declared Field into its physical slots. A single-slot Field
 * named "value" keeps the plain snake-case column; other slots become
 * `field__slot`, which a declaration can never produce because Field names
 * cannot contain underscores.
 */
export function physicalLayout(collectionName: string, fields: FieldMap): PhysicalLayout {
    const seenColumns = new Set(systemFieldNames.map(toColumnName));
    const resolved: PhysicalFieldLayout[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
        const slots = capsuleOf(field).slots();
        const slotNames = Object.keys(slots);
        const single = slotNames.length === 1 && slotNames[0] === "value";
        const keys = single ? [fieldName] : slotNames.map(slotName => `${fieldName}__${slotName}`);
        const columns =
            single ?
                [toColumnName(fieldName)]
            :   slotNames.map(slotName => `${toColumnName(fieldName)}__${toColumnName(slotName)}`);

        for (const slotName of slotNames) {
            if (!SLOT_NAME.test(slotName)) {
                fail(collectionName, `the Field "${fieldName}" has an invalid slot name "${slotName}".`);
            }
        }

        for (const column of columns) {
            if (seenColumns.has(column)) {
                fail(collectionName, `the Field "${fieldName}" collides with another physical column "${column}".`);
            }

            seenColumns.add(column);
        }

        resolved.push({ fieldName, slotNames, keys, columns });
    }

    const byField = Object.fromEntries(resolved.map(layout => [layout.fieldName, layout])) as Record<
        string,
        PhysicalFieldLayout
    >;

    return {
        fields: resolved,
        byField,
        total: systemFieldNames.length + resolved.reduce((sum, layout) => sum + layout.columns.length, 0)
    };
}

/**
 * Turns one logical Field's slot cells into its logical value. An all-null shape
 * is a null logical value; a non-null shape must fill every non-nullable slot.
 */
export function decodePhysicalCells(field: Field, cells: Record<string, SQLiteCell>): unknown {
    const values = Object.values(cells);

    if (values.every(value => value === null)) {
        return null;
    }

    const slots = capsuleOf(field).slots();

    for (const [slotName, definition] of Object.entries(slots)) {
        if (cells[slotName] === null && definition.nullable !== true) {
            throw new Error(`The ${field.kind} Field has null in its required slot "${slotName}".`);
        }
    }

    return capsuleOf(field).decode(cells);
}

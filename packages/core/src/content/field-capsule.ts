import type { SQLiteColumnBuilderBase } from "drizzle-orm/sqlite-core";
import type { Field } from "./fields";

/**
 * Hidden, Worker-safe behavior compiled for one Field kind. Core owns the
 * dispatch sites; implementation details such as Drizzle stay out of the public
 * Field interface.
 */
export interface FieldCapsule<TValue = unknown> {
    buildColumn(name: string): SQLiteColumnBuilderBase;
    /** Non-null canonical value -> D1 binding. */
    databaseValue(value: TValue): string | number | null;
    /** Non-null canonical value -> Revision v1 payload. */
    snapshotValue(value: TValue): unknown;
    /** Revision v1 payload -> represented value, before Field.parse. */
    valueFromSnapshot(value: unknown): unknown;
    /** One submitted string -> represented value. */
    submissionValue(raw: string): unknown;
    isBlankSubmission(raw: string): boolean;
    isRequiredValueMissing(value: unknown): boolean;
    /** Serializable extras appended to the Editing descriptor. */
    editingExtras(): Record<string, unknown> | undefined;
}

const fieldCapsule: unique symbol = Symbol("jamcaa.field-capsule");

export type CompiledField = Field & { readonly [fieldCapsule]: FieldCapsule };

export function compileField<TField extends Field, TValue = unknown>(
    field: TField,
    capsule: FieldCapsule<TValue>
): TField & { readonly [fieldCapsule]: FieldCapsule<TValue> } {
    return Object.assign(field, { [fieldCapsule]: capsule }) as TField & {
        readonly [fieldCapsule]: FieldCapsule<TValue>;
    };
}

export function capsuleOf(field: Field): FieldCapsule {
    const capsule = (field as Partial<CompiledField>)[fieldCapsule];

    if (capsule === undefined) {
        throw new Error(`The ${field.kind} Field has no compiled behavior.`);
    }

    return capsule;
}

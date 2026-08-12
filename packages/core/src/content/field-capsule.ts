import type { SQLiteColumnBuilderBase } from "drizzle-orm/sqlite-core";
import type { Field } from "./fields";

export type SQLiteAffinity = "text" | "integer" | "real" | "blob";

/** What D1 accepts as one bound value. */
export type SQLiteCell = string | number | Uint8Array | null;

export interface StorageSlot {
    readonly affinity: SQLiteAffinity;
    /** Whether this slot may hold null inside a non-null logical value. */
    readonly nullable?: true;
    buildColumn(name: string): SQLiteColumnBuilderBase;
}

export type StorageSlots = Readonly<Record<string, StorageSlot>>;

export function slot(definition: StorageSlot): StorageSlot {
    return definition;
}

/**
 * Hidden, Worker-safe behavior compiled for one Field kind. Core owns the
 * dispatch sites; implementation details such as Drizzle stay out of the public
 * Field interface.
 */
export interface FieldCapsule<TValue = unknown> {
    /** Physical slots in canonical order. Single-slot Fields use the name "value". */
    slots(): StorageSlots;
    /** Non-null canonical value -> one cell per slot, no extra keys. */
    encode(value: TValue): Record<string, SQLiteCell>;
    /** Slot cells of a non-null logical value -> represented value, before Field.parse. */
    decode(cells: Record<string, SQLiteCell>): unknown;
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

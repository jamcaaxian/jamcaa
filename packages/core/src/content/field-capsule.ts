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

/** The restricted Search text expression a Field contributes. */
export type FieldSearchText = { type: "column-text"; slot: string } | { type: "rich-text"; slot: string };

export function slot(definition: StorageSlot): StorageSlot {
    return definition;
}

/**
 * The Revision codec every built-in Field writes today: one stable version
 * whose payload matches the Revision v1 representation. Future Field kinds
 * ship their own versioned codecs.
 */
export function revisionCodecV1<TValue>(
    encode: (value: TValue) => unknown,
    decode: (payload: unknown) => unknown
): Pick<FieldCapsule<TValue>, "revisionVersion" | "revisionEncode" | "revisionDecode"> {
    return {
        revisionVersion: () => 1,
        revisionEncode: encode,
        revisionDecode: (version, payload) => {
            if (version !== 1) {
                throw new Error(`Revision codec ${version} is not known.`);
            }

            return decode(payload);
        }
    };
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
    /** Current Revision codec version written into new snapshots. */
    revisionVersion(): number;
    /** Non-null canonical value -> Revision payload for the current codec. */
    revisionEncode(value: TValue): unknown;
    /** Revision payload of one codec version -> represented value, before Field.parse. */
    revisionDecode(version: number, payload: unknown): unknown;
    /** One submitted string -> represented value. */
    submissionValue(raw: string): unknown;
    isBlankSubmission(raw: string): boolean;
    isRequiredValueMissing(value: unknown): boolean;
    /** Serializable extras appended to the Editing descriptor. */
    editingExtras(): Record<string, unknown> | undefined;
    /** The restricted Search text expression, or undefined when not searchable. */
    searchText(): FieldSearchText | undefined;
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

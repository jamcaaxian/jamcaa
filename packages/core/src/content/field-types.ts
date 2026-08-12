import type { SQLiteColumnBuilderBase } from "drizzle-orm/sqlite-core";
import {
    compileField,
    slot,
    type FieldCapsule,
    type FieldSearchText,
    type SQLiteAffinity,
    type SQLiteCell
} from "./field-capsule";
import { isBuiltinFieldKind, type Field, type FieldOptions, type Held } from "./fields";

/** Third-party kinds carry a non-empty namespace, like `@acme/geo-point`. */
const NAMESPACED_KIND = /^@?[A-Za-z][A-Za-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*$/;

export function validateThirdPartyKind(kind: string): void {
    if (isBuiltinFieldKind(kind)) {
        throw new Error(`Field kind "${kind}" is built in; Field Types can only declare new kinds.`);
    }

    if (!NAMESPACED_KIND.test(kind)) {
        throw new Error(`Field kind "${kind}" needs a namespace, like "@acme/geo-point".`);
    }
}

export interface FieldTypeDefinition<TValue = unknown> {
    /** Namespaced kind string, e.g. `@acme/geo-point`. */
    kind: string;
    /** Kind the Editing Control registry dispatches by. Defaults to kind. */
    editingKind?: string;
    /** Worker-safe compiled behavior. */
    capsule: FieldCapsule<TValue>;
    /** Normalises and validates values crossing the collection boundary. */
    parse: (value: unknown) => TValue;
}

/** One statically installed Field Type. */
export interface FieldType<TValue = unknown, TKind extends string = string> {
    readonly kind: TKind;
    readonly editingKind: string;
    readonly capsule: FieldCapsule<TValue>;
    readonly parse: (value: unknown) => TValue;
    create<const TOptions extends FieldOptions = FieldOptions>(
        options?: TOptions
    ): Field<Held<TValue, TOptions>, TKind>;
}

/**
 * Declares a third-party Field kind with its full compiled behavior. The kind
 * must be namespaced; built-in kinds are reserved for the Platform.
 */
export function defineFieldType<TValue = unknown, TKind extends string = string>(
    definition: FieldTypeDefinition<TValue> & { readonly kind: TKind }
): FieldType<TValue, TKind> {
    validateThirdPartyKind(definition.kind);

    const editingKind = definition.editingKind ?? definition.kind;

    return {
        kind: definition.kind,
        editingKind,
        capsule: definition.capsule,
        parse: definition.parse,
        create<const TOptions extends FieldOptions = FieldOptions>(
            options?: TOptions
        ): Field<Held<TValue, TOptions>, TKind> {
            const field: Field<Held<TValue, TOptions>, TKind> = {
                kind: definition.kind,
                editingKind,
                label: options?.label,
                description: options?.description,
                required: options?.required ?? false,
                parse: definition.parse
            };

            return compileField(field, definition.capsule);
        }
    };
}

export interface ScalarFieldTypeDefinition<TValue extends SQLiteCell = string> {
    /** Namespaced kind string, e.g. `@acme/geo-point`. */
    kind: string;
    /** Kind the Editing Control registry dispatches by. Defaults to kind. */
    editingKind?: string;
    affinity: SQLiteAffinity;
    buildColumn(name: string): SQLiteColumnBuilderBase;
    /** Normalises and validates values crossing the collection boundary. */
    parse: (value: unknown) => TValue;
    storageVersion?: () => number;
    searchVersion?: () => number;
    snapshotValue?: (value: TValue) => unknown;
    valueFromSnapshot?: (value: unknown) => unknown;
    submissionValue?: (raw: string) => unknown;
    isBlankSubmission?: (raw: string) => boolean;
    isRequiredValueMissing?: (value: unknown) => boolean;
    /** The restricted Search text expression, or undefined when not searchable. */
    searchText?: () => FieldSearchText | undefined;
    /** Serializable extras appended to the Editing descriptor. */
    editingExtras?: () => Record<string, unknown> | undefined;
}

/**
 * Declares a third-party Field kind stored in one physical column, with
 * identity encode/decode and Revision codec v1 unless overridden.
 */
export function defineScalarFieldType<TValue extends SQLiteCell = string, TKind extends string = string>(
    definition: ScalarFieldTypeDefinition<TValue> & { readonly kind: TKind }
): FieldType<TValue, TKind> {
    const storageVersion = definition.storageVersion ?? (() => 1);
    const searchVersion = definition.searchVersion ?? (() => 1);
    const snapshotValue = definition.snapshotValue ?? ((value: TValue) => value);
    const valueFromSnapshot = definition.valueFromSnapshot ?? ((value: unknown) => value);
    const submissionValue = definition.submissionValue ?? ((raw: string) => raw);
    const isBlankSubmission = definition.isBlankSubmission ?? ((raw: string) => raw.trim().length === 0);
    const isRequiredValueMissing = definition.isRequiredValueMissing ?? (() => false);
    const searchText = definition.searchText ?? (() => undefined);
    const editingExtras = definition.editingExtras ?? (() => undefined);

    return defineFieldType<TValue, TKind>({
        kind: definition.kind,
        editingKind: definition.editingKind,
        parse: definition.parse,
        capsule: {
            slots: () => ({ value: slot({ affinity: definition.affinity, buildColumn: definition.buildColumn }) }),
            storageVersion,
            searchVersion,
            encode: value => ({ value }),
            decode: cells => cells.value,
            snapshotValue,
            valueFromSnapshot,
            revisionVersion: () => 1,
            revisionEncode: snapshotValue,
            revisionDecode: (version, payload) => {
                if (version !== 1) {
                    throw new Error(`Revision codec ${version} is not known.`);
                }

                return valueFromSnapshot(payload);
            },
            submissionValue,
            isBlankSubmission,
            isRequiredValueMissing,
            editingExtras,
            searchText
        }
    });
}

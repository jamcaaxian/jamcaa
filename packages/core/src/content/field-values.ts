import { capsuleOf } from "./field-capsule";
import type { Field } from "./fields";

export function canonicalFieldValue(field: Field, value: unknown): unknown {
    if (value === null) {
        if (field.required) {
            throw new Error(`A required ${field.kind} Field cannot be null.`);
        }

        return null;
    }

    if (field.parse === undefined) {
        throw new Error(`The ${field.kind} Field has no parse contract.`);
    }

    return field.parse(value);
}

export function fieldSnapshotValue(field: Field, value: unknown): unknown {
    const canonical = canonicalFieldValue(field, value);

    if (canonical === null) {
        return null;
    }

    return capsuleOf(field).snapshotValue(canonical);
}

export function fieldValueFromSnapshot(field: Field, value: unknown): unknown {
    if (value === null) {
        return canonicalFieldValue(field, value);
    }

    return canonicalFieldValue(field, capsuleOf(field).valueFromSnapshot(value));
}

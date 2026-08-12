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

export function fieldDatabaseValue(field: Field, value: unknown): string | number | null {
    const canonical = canonicalFieldValue(field, value);

    if (canonical === null) {
        return null;
    }

    switch (field.kind) {
        case "richText":
            return JSON.stringify(canonical);
        case "toggle":
            return canonical ? 1 : 0;
        case "moment":
            return (canonical as Date).getTime();
        case "number":
            return canonical as number;
        case "text":
        case "markdown":
        case "choice":
        case "reference":
            return canonical as string;
    }
}

export function fieldSnapshotValue(field: Field, value: unknown): unknown {
    const canonical = canonicalFieldValue(field, value);

    return field.kind === "moment" && canonical !== null ? (canonical as Date).getTime() : canonical;
}

export function fieldValueFromSnapshot(field: Field, value: unknown): unknown {
    if (value === null) {
        return canonicalFieldValue(field, value);
    }

    return canonicalFieldValue(field, field.kind === "moment" && typeof value === "number" ? new Date(value) : value);
}

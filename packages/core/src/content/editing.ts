import type { Collection, FieldMap } from "./collection";
import { canonicalFieldValue } from "./field-values";
import type { Field, FieldValue } from "./fields";
import { isRichTextEmpty } from "./rich-text";

interface EditingFieldBase {
    name: string;
    label: string;
    description?: string;
    required: boolean;
}

export type EditingField =
    | (EditingFieldBase & { kind: "text" | "markdown" | "richText" | "toggle" | "moment" })
    | (EditingFieldBase & { kind: "number"; whole: boolean })
    | (EditingFieldBase & { kind: "choice"; choices: readonly string[] })
    | (EditingFieldBase & { kind: "reference"; collection: string });

type CollectionFieldValues<TCollection extends Collection> = {
    [TName in keyof TCollection["fields"]]: FieldValue<TCollection["fields"][TName]>;
};

export type SubmissionIssueCode = "invalid" | "required";

export interface SubmissionIssue<TName extends string = string> {
    field: TName;
    code: SubmissionIssueCode;
}

export type CollectionSubmission<TCollection extends Collection> =
    | { success: true; values: CollectionFieldValues<TCollection> }
    | { success: false; issues: SubmissionIssue<keyof TCollection["fields"] & string>[] };

function humanise(name: string): string {
    const spaced = name
        .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll(/[_-]+/g, " ")
        .trim();

    return spaced ? `${spaced[0]!.toUpperCase()}${spaced.slice(1)}` : name;
}

export function editingFields<TFields extends FieldMap>(collection: Collection<TFields>): EditingField[] {
    return Object.entries(collection.fields).map(([name, field]) => {
        const common = {
            name,
            label: field.label ?? humanise(name),
            ...(field.description === undefined ? {} : { description: field.description }),
            required: field.required
        };

        switch (field.kind) {
            case "number":
                return { ...common, kind: field.kind, whole: field.whole ?? false };
            case "choice":
                return { ...common, kind: field.kind, choices: field.choices ?? [] };
            case "reference":
                return { ...common, kind: field.kind, collection: field.references ?? "" };
            default:
                return { ...common, kind: field.kind };
        }
    });
}

function valueFor(field: Field, raw: string): unknown {
    switch (field.kind) {
        case "text":
            return raw.trim();
        case "markdown":
            return raw;
        case "richText":
            return JSON.parse(raw) as unknown;
        case "number":
            return Number(raw);
        case "toggle":
            return (
                raw === "true" ? true
                : raw === "false" ? false
                : undefined
            );
        case "moment": {
            return new Date(raw);
        }
        case "choice":
            return raw;
        case "reference":
            return raw.trim();
    }
}

function isBlankSubmission(field: Field, raw: string): boolean {
    return field.kind === "richText" ? raw.length === 0 : raw.trim().length === 0;
}

function isRequiredValueMissing(field: Field, value: unknown): boolean {
    if (field.kind === "richText") {
        return isRichTextEmpty(value as never);
    }

    return (field.kind === "text" || field.kind === "markdown") && value === "";
}

export function parseCollectionSubmission<TCollection extends Collection>(
    collection: TCollection,
    formData: FormData
): CollectionSubmission<TCollection> {
    const values: Record<string, unknown> = {};
    const issues: SubmissionIssue<keyof TCollection["fields"] & string>[] = [];

    for (const [fieldName, field] of Object.entries(collection.fields)) {
        const submitted = formData.getAll(fieldName);

        if (submitted.length === 0) {
            if (field.required) {
                issues.push({ field: fieldName as keyof TCollection["fields"] & string, code: "required" });
            } else {
                values[fieldName] = null;
            }

            continue;
        }

        if (submitted.length !== 1 || typeof submitted[0] !== "string") {
            issues.push({ field: fieldName as keyof TCollection["fields"] & string, code: "invalid" });
            continue;
        }

        const raw = submitted[0];

        if (isBlankSubmission(field, raw)) {
            if (field.required) {
                issues.push({ field: fieldName as keyof TCollection["fields"] & string, code: "required" });
            } else {
                values[fieldName] = null;
            }

            continue;
        }

        try {
            const represented = valueFor(field, raw);
            const parsed = canonicalFieldValue(field, represented);

            if (field.required && isRequiredValueMissing(field, parsed)) {
                issues.push({ field: fieldName as keyof TCollection["fields"] & string, code: "required" });
            } else {
                values[fieldName] = parsed;
            }
        } catch {
            issues.push({ field: fieldName as keyof TCollection["fields"] & string, code: "invalid" });
        }
    }

    return issues.length > 0 ? { success: false, issues } : { success: true, values: values as never };
}

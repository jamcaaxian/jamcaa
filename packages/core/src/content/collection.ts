import type { Field, FieldValue, SearchableFieldKind, SummaryFieldKind } from "./fields";
import { systemFieldNames, type SystemFields } from "./system-fields";

/** D1 refuses a table with more than this many columns. */
const MAX_COLUMNS = 100;

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;
const COLLECTION_NAME = /^[a-z][a-z0-9_]*$/;

/** Owned by the core's own migrations; a collection cannot claim them. */
const RESERVED_TABLE_NAMES = new Set([
    "account",
    "bucket",
    "category",
    "media",
    "multipart_upload",
    "role",
    "role_capability",
    "session",
    "setting",
    "storage_rule",
    "tag",
    "user",
    "verification"
]);

export type FieldMap = Record<string, Field>;

export type SearchableFieldName<TFields extends FieldMap> = {
    [TName in keyof TFields]: TFields[TName]["kind"] extends SearchableFieldKind ? TName : never;
}[keyof TFields]
    & string;

export type SummaryFieldName<TFields extends FieldMap> = {
    [TName in keyof TFields]: TFields[TName]["kind"] extends SummaryFieldKind ? TName : never;
}[keyof TFields]
    & string;

export interface SearchDeclaration<TFields extends FieldMap = FieldMap> {
    /** Fields are indexed and ranked in this declaration order. */
    readonly fields: readonly SearchableFieldName<TFields>[];
}

export interface SummaryDeclaration<TFields extends FieldMap = FieldMap> {
    /** Lightweight Fields returned with system Fields in a public Entry Summary. */
    readonly fields: readonly SummaryFieldName<TFields>[];
}

export interface CollectionDeclaration<TFields extends FieldMap = FieldMap> {
    /** Becomes the table name, so it is lower snake case. */
    readonly name: string;
    readonly label: string;
    /** Shown wherever the admin refers to more than one entry. */
    readonly plural: string;
    readonly fields: TFields;
    /** The field to show when an entry has to be named in a list. */
    readonly titleField?: keyof TFields & string;
    /** The public full-text projection. Omit it when this Collection is not searchable. */
    readonly search?: SearchDeclaration<TFields>;
    /** The public lightweight projection. Omit it when this Collection has no public lists or feed. */
    readonly summary?: SummaryDeclaration<TFields>;
}

export interface Collection<
    TFields extends FieldMap = FieldMap,
    TName extends string = string,
    TSummaryFields extends readonly string[] | undefined = readonly string[] | undefined
> {
    readonly name: TName;
    readonly label: string;
    readonly plural: string;
    readonly fields: TFields;
    // Narrowed to the declared keys while authoring, but plain here: `keyof TFields`
    // would make Collection invariant, and a specific collection could then not be
    // passed anywhere that accepts collections in general.
    readonly titleField: string;
    readonly search: { readonly fields: readonly string[] } | undefined;
    readonly summary: TSummaryFields extends readonly string[] ? { readonly fields: TSummaryFields } : undefined;
}

export type EntryOf<TCollection extends Collection> = SystemFields & {
    [TName in keyof TCollection["fields"]]: FieldValue<TCollection["fields"][TName]>;
};

function fail(collection: string, problem: string): never {
    throw new Error(`Collection "${collection}": ${problem}`);
}

/**
 * Checks a collection the moment it is declared, so a site fails to start rather
 * than failing when a migration runs or a form is opened.
 */
export function defineCollection<
    const TName extends string,
    const TFields extends FieldMap,
    const TSummaryFields extends readonly SummaryFieldName<TFields>[] | undefined = undefined
>(
    declaration: CollectionDeclaration<TFields> & { readonly name: TName } & {
        readonly summary?: TSummaryFields extends readonly SummaryFieldName<TFields>[] ? { fields: TSummaryFields }
        :   never;
    }
): Collection<TFields, TName, TSummaryFields> {
    const { name, fields } = declaration;

    if (!COLLECTION_NAME.test(name)) {
        fail(name, "the name becomes a table name, so it must be lower case and start with a letter.");
    }

    if (RESERVED_TABLE_NAMES.has(name)) {
        fail(name, "that name belongs to one of the platform's own tables.");
    }

    const fieldNames = Object.keys(fields);

    if (fieldNames.length === 0) {
        fail(name, "a collection needs at least one field.");
    }

    for (const fieldName of fieldNames) {
        if (!IDENTIFIER.test(fieldName)) {
            fail(name, `the field "${fieldName}" must be a camel case name starting with a letter.`);
        }

        if (systemFieldNames.includes(fieldName)) {
            fail(name, `the field "${fieldName}" collides with a field every entry already has.`);
        }
    }

    if (declaration.search !== undefined) {
        const searchFields = declaration.search.fields as readonly string[];

        if (searchFields.length === 0) {
            fail(name, "search needs at least one Field.");
        }

        const seen = new Set<string>();

        for (const fieldName of searchFields) {
            const field = fields[fieldName];

            if (field === undefined) {
                fail(name, `the searchable Field "${fieldName}" is not one of its Fields.`);
            }

            if (!(["text", "markdown", "richText"] as const).includes(field.kind as SearchableFieldKind)) {
                fail(name, `the Field "${fieldName}" has no searchable text representation.`);
            }

            if (seen.has(fieldName)) {
                fail(name, `the searchable Field "${fieldName}" is declared more than once.`);
            }

            seen.add(fieldName);
        }
    }

    const columns = systemFieldNames.length + fieldNames.length;

    if (columns > MAX_COLUMNS) {
        fail(
            name,
            `it would need ${columns} columns and D1 allows ${MAX_COLUMNS}. `
                + `${systemFieldNames.length} of those belong to every entry, leaving `
                + `${MAX_COLUMNS - systemFieldNames.length} for declared fields.`
        );
    }

    const titleField = declaration.titleField ?? findTitleField(fields);

    if (titleField === undefined) {
        fail(name, "no field can name an entry in a list; declare a text field or set titleField.");
    }

    if (!(titleField in fields)) {
        fail(name, `titleField "${titleField}" is not one of its fields.`);
    }

    if (declaration.summary !== undefined) {
        const summaryFields = declaration.summary.fields as readonly string[];

        if (summaryFields.length === 0) {
            fail(name, "summary needs at least one Field.");
        }

        const seen = new Set<string>();

        for (const fieldName of summaryFields) {
            const field = fields[fieldName];

            if (field === undefined) {
                fail(name, `the summary Field "${fieldName}" is not one of its Fields.`);
            }

            if ((["markdown", "richText"] as const).includes(field.kind as "markdown" | "richText")) {
                fail(name, `the Field "${fieldName}" is long-form content and cannot enter an Entry Summary.`);
            }

            if (seen.has(fieldName)) {
                fail(name, `the summary Field "${fieldName}" is declared more than once.`);
            }

            seen.add(fieldName);
        }

        if (!seen.has(titleField)) {
            fail(name, `summary must include its titleField "${titleField}".`);
        }
    }

    return {
        ...declaration,
        titleField,
        search: declaration.search,
        summary: declaration.summary as Collection<TFields, TName, TSummaryFields>["summary"]
    };
}

function findTitleField(fields: FieldMap): string | undefined {
    return Object.keys(fields).find(fieldName => fields[fieldName]?.kind === "text");
}

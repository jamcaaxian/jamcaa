import type { Field, FieldValue } from "./fields";
import { systemFieldNames, type SystemFields } from "./system-fields";

/** D1 refuses a table with more than this many columns. */
const MAX_COLUMNS = 100;

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;
const COLLECTION_NAME = /^[a-z][a-z0-9_]*$/;

/** Owned by the core's own migrations; a collection cannot claim them. */
const RESERVED_TABLE_NAMES = new Set(["user", "session", "account", "verification", "role", "role_capability"]);

export type FieldMap = Record<string, Field>;

export interface CollectionDeclaration<TFields extends FieldMap = FieldMap> {
    /** Becomes the table name, so it is lower snake case. */
    readonly name: string;
    readonly label: string;
    /** Shown wherever the admin refers to more than one entry. */
    readonly plural: string;
    readonly fields: TFields;
    /** The field to show when an entry has to be named in a list. */
    readonly titleField?: keyof TFields & string;
}

export interface Collection<TFields extends FieldMap = FieldMap> {
    readonly name: string;
    readonly label: string;
    readonly plural: string;
    readonly fields: TFields;
    // Narrowed to the declared keys while authoring, but plain here: `keyof TFields`
    // would make Collection invariant, and a specific collection could then not be
    // passed anywhere that accepts collections in general.
    readonly titleField: string;
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
export function defineCollection<const TFields extends FieldMap>(
    declaration: CollectionDeclaration<TFields>
): Collection<TFields> {
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

    return { ...declaration, titleField };
}

function findTitleField(fields: FieldMap): string | undefined {
    return Object.keys(fields).find(fieldName => fields[fieldName]?.kind === "text");
}

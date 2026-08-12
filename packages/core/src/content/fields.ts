import {
    integer as sqliteInteger,
    real as sqliteReal,
    text as sqliteText,
    type SQLiteColumnBuilderBase
} from "drizzle-orm/sqlite-core";
import { parseRichText, isRichTextEmpty, type RichTextDocument } from "./rich-text";
import { compileField } from "./field-capsule";

export type FieldKind = "text" | "markdown" | "richText" | "number" | "toggle" | "moment" | "choice" | "reference";

export interface FieldOptions {
    /** Shown above the control in the admin. Defaults to the field name, humanised. */
    label?: string;
    description?: string;
    required?: boolean;
}

export interface Field<TValue = unknown, TKind extends FieldKind = FieldKind> {
    readonly kind: TKind;
    readonly label: string | undefined;
    readonly description: string | undefined;
    readonly required: boolean;
    /** Whether a number Field accepts only safe integers. */
    readonly whole?: boolean;
    /** The accepted values of a choice Field. */
    readonly choices?: readonly string[];
    /** The collection a reference field points at. Absent on every other kind. */
    readonly references?: string;
    /** Carries the field's value type. Never assigned; erased at runtime. */
    readonly valueType?: TValue;
    /** Normalises and validates a value before it crosses the collection boundary. */
    readonly parse?: (value: unknown) => TValue;
}

export type FieldValue<TField> = TField extends Field<infer TValue, FieldKind> ? TValue : never;

export type SearchableFieldKind = Extract<FieldKind, "text" | "markdown" | "richText">;

/** Fields whose values can be read cheaply in public Entry Summaries. */
export type SummaryFieldKind = Exclude<FieldKind, "markdown" | "richText">;

/** A field is nullable unless it was declared with `required: true`. */
type Held<TValue, TOptions extends FieldOptions> = TOptions extends { required: true } ? TValue : TValue | null;

function base<const TKind extends FieldKind>(kind: TKind, options: FieldOptions | undefined) {
    return { kind, label: options?.label, description: options?.description, required: options?.required ?? false };
}

function column<TBuilder extends SQLiteColumnBuilderBase & { notNull(): SQLiteColumnBuilderBase }>(
    builder: TBuilder,
    required: boolean
): SQLiteColumnBuilderBase {
    // notNull() narrows the builder's type, which a table assembled at runtime
    // cannot track. The declaration stays the source of truth for what a value holds.
    return required ? builder.notNull() : builder;
}

/** A single line of plain text: titles, slugs, names. */
export function text<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<string, TOptions>, "text"> {
    const definition = base("text", options);

    return compileField(
        {
            ...definition,
            parse: value => {
                if (typeof value !== "string") {
                    throw new Error("A text Field needs text.");
                }

                return value as Held<string, TOptions>;
            }
        },
        {
            buildColumn: name => column(sqliteText(name), definition.required),
            databaseValue: (value: string) => value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => raw.trim(),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: value => value === "",
            editingExtras: () => undefined
        }
    );
}

/** Long-form body content, stored and edited as Markdown. */
export function markdown<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<string, TOptions>, "markdown"> {
    const definition = base("markdown", options);

    return compileField(
        {
            ...definition,
            parse: value => {
                if (typeof value !== "string") {
                    throw new Error("A Markdown Field needs text.");
                }

                return value as Held<string, TOptions>;
            }
        },
        {
            buildColumn: name => column(sqliteText(name), definition.required),
            databaseValue: (value: string) => value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => raw,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: value => value === "",
            editingExtras: () => undefined
        }
    );
}

/** Structured long-form content stored as ProseMirror JSON. */
export function richText<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<RichTextDocument, TOptions>, "richText"> {
    const definition = base("richText", options);

    return compileField(
        { ...definition, parse: value => parseRichText(value) },
        {
            buildColumn: name =>
                column(sqliteText(name, { mode: "json" }).$type<RichTextDocument>(), definition.required),
            databaseValue: (value: RichTextDocument) => JSON.stringify(value),
            snapshotValue: (value: RichTextDocument) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => JSON.parse(raw) as unknown,
            isBlankSubmission: raw => raw.length === 0,
            isRequiredValueMissing: value => isRichTextEmpty(value as RichTextDocument),
            editingExtras: () => undefined
        }
    );
}

export interface NumberOptions extends FieldOptions {
    /** Whole numbers are stored as integers, which SQLite compares and sorts exactly. */
    whole?: boolean;
}

export function number<const TOptions extends NumberOptions = NumberOptions>(
    options?: TOptions
): Field<Held<number, TOptions>, "number"> {
    const definition = base("number", options);
    const whole = options?.whole ?? false;

    return compileField(
        {
            ...definition,
            whole,
            parse: value => {
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    throw new Error("A number Field needs a finite number.");
                }

                if (whole && !Number.isSafeInteger(value)) {
                    throw new Error("A whole number Field needs a safe integer.");
                }

                return value as Held<number, TOptions>;
            }
        },
        {
            buildColumn: name => column(whole ? sqliteInteger(name) : sqliteReal(name), definition.required),
            databaseValue: (value: number) => value,
            snapshotValue: (value: number) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => Number(raw),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ whole })
        }
    );
}

/** A yes or no. SQLite has no boolean, so this is an integer Drizzle reads as one. */
export function toggle<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<boolean, TOptions>, "toggle"> {
    const definition = base("toggle", options);

    return compileField(
        {
            ...definition,
            parse: value => {
                if (typeof value !== "boolean") {
                    throw new Error("A toggle Field needs true or false.");
                }

                return value as Held<boolean, TOptions>;
            }
        },
        {
            buildColumn: name => column(sqliteInteger(name, { mode: "boolean" }), definition.required),
            databaseValue: (value: boolean) => (value ? 1 : 0),
            snapshotValue: (value: boolean) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw =>
                raw === "true" ? true
                : raw === "false" ? false
                : undefined,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined
        }
    );
}

/** A point in time, stored as milliseconds since the epoch. */
export function moment<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<Date, TOptions>, "moment"> {
    const definition = base("moment", options);

    return compileField(
        {
            ...definition,
            parse: value => {
                if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
                    throw new Error("A moment Field needs a valid Date.");
                }

                return value as Held<Date, TOptions>;
            }
        },
        {
            buildColumn: name => column(sqliteInteger(name, { mode: "timestamp_ms" }), definition.required),
            databaseValue: (value: Date) => value.getTime(),
            snapshotValue: (value: Date) => value.getTime(),
            valueFromSnapshot: value => (typeof value === "number" ? new Date(value) : value),
            submissionValue: raw => new Date(raw),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined
        }
    );
}

export interface ChoiceOptions<TChoice extends string> extends FieldOptions {
    of: readonly TChoice[];
}

/** One value from a fixed set. Drizzle's enum narrows types only, so the set is
 * checked before writing rather than by the database. */
export function choice<
    const TChoice extends string,
    const TOptions extends ChoiceOptions<TChoice> = ChoiceOptions<TChoice>
>(options: TOptions & ChoiceOptions<TChoice>): Field<Held<TChoice, TOptions>, "choice"> {
    const definition = base("choice", options);

    return compileField(
        {
            ...definition,
            choices: options.of,
            parse: value => {
                if (typeof value !== "string" || !options.of.includes(value as TChoice)) {
                    throw new Error("A choice Field needs one of its declared choices.");
                }

                return value as Held<TChoice, TOptions>;
            }
        },
        {
            buildColumn: name =>
                column(sqliteText(name, { enum: options.of as [TChoice, ...TChoice[]] }), definition.required),
            databaseValue: (value: string) => value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => raw,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ choices: options.of })
        }
    );
}

export interface ReferenceOptions extends FieldOptions {
    /** The name of the collection being pointed at. */
    to: string;
}

/** Points at one entry of another collection by its identifier. */
export function reference<const TOptions extends ReferenceOptions = ReferenceOptions>(
    options: TOptions & ReferenceOptions
): Field<Held<string, TOptions>, "reference"> {
    const definition = base("reference", options);

    return compileField(
        {
            ...definition,
            references: options.to,
            parse: value => {
                if (typeof value !== "string" || !value.trim()) {
                    throw new Error("A reference Field needs an Entry identifier.");
                }

                return value.trim() as Held<string, TOptions>;
            }
        },
        {
            buildColumn: name => column(sqliteText(name), definition.required),
            databaseValue: (value: string) => value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            submissionValue: raw => raw.trim(),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ collection: options.to })
        }
    );
}

import {
    integer as sqliteInteger,
    real as sqliteReal,
    text as sqliteText,
    type SQLiteColumnBuilderBase
} from "drizzle-orm/sqlite-core";
import { parseRichText, type RichTextDocument } from "./rich-text";

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
    /** The collection a reference field points at. Absent on every other kind. */
    readonly references?: string;
    /** Carries the field's value type. Never assigned; erased at runtime. */
    readonly valueType?: TValue;
    /** Normalises and validates a value before it crosses the collection boundary. */
    readonly parse?: (value: unknown) => TValue;
    buildColumn(name: string): SQLiteColumnBuilderBase;
}

export type FieldValue<TField> = TField extends Field<infer TValue, FieldKind> ? TValue : never;

export type SearchableFieldKind = Extract<FieldKind, "text" | "markdown" | "richText">;

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

    return { ...definition, buildColumn: name => column(sqliteText(name), definition.required) };
}

/** Long-form body content, stored and edited as Markdown. */
export function markdown<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<string, TOptions>, "markdown"> {
    const definition = base("markdown", options);

    return { ...definition, buildColumn: name => column(sqliteText(name), definition.required) };
}

/** Structured long-form content stored as ProseMirror JSON. */
export function richText<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<RichTextDocument, TOptions>, "richText"> {
    const definition = base("richText", options);

    return {
        ...definition,
        parse: value => parseRichText(value),
        buildColumn: name => column(sqliteText(name, { mode: "json" }).$type<RichTextDocument>(), definition.required)
    };
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

    return {
        ...definition,
        buildColumn: name => column(whole ? sqliteInteger(name) : sqliteReal(name), definition.required)
    };
}

/** A yes or no. SQLite has no boolean, so this is an integer Drizzle reads as one. */
export function toggle<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<boolean, TOptions>, "toggle"> {
    const definition = base("toggle", options);

    return {
        ...definition,
        buildColumn: name => column(sqliteInteger(name, { mode: "boolean" }), definition.required)
    };
}

/** A point in time, stored as milliseconds since the epoch. */
export function moment<const TOptions extends FieldOptions = FieldOptions>(
    options?: TOptions
): Field<Held<Date, TOptions>, "moment"> {
    const definition = base("moment", options);

    return {
        ...definition,
        buildColumn: name => column(sqliteInteger(name, { mode: "timestamp_ms" }), definition.required)
    };
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

    return {
        ...definition,
        buildColumn: name =>
            column(sqliteText(name, { enum: options.of as [TChoice, ...TChoice[]] }), definition.required)
    };
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

    return {
        ...definition,
        references: options.to,
        buildColumn: name => column(sqliteText(name), definition.required)
    };
}

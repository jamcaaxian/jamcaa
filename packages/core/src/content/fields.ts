import { integer as sqliteInteger, real as sqliteReal, text as sqliteText } from "drizzle-orm/sqlite-core";
import { parseRichText, isRichTextEmpty, type RichTextDocument } from "./rich-text";
import { blockPlainText, parseBlockDocument, type BlockDocument, type BlockRegistry } from "./blocks";
import { builtinContractVersions, compileField, revisionCodecV1, slot } from "./field-capsule";

export type FieldKind =
    "text" | "markdown" | "richText" | "blocks" | "number" | "toggle" | "moment" | "choice" | "reference";

/** The kinds the Platform compiles itself; every other kind needs a Field Type. */
export const builtinFieldKinds: readonly FieldKind[] = [
    "text",
    "markdown",
    "richText",
    "blocks",
    "number",
    "toggle",
    "moment",
    "choice",
    "reference"
];

export function isBuiltinFieldKind(kind: string): kind is FieldKind {
    return (builtinFieldKinds as readonly string[]).includes(kind);
}

export interface FieldOptions {
    /** Shown above the control in the admin. Defaults to the field name, humanised. */
    label?: string;
    description?: string;
    required?: boolean;
}

export interface Field<TValue = unknown, TKind extends string = string> {
    readonly kind: TKind;
    /** The kind the Editing Control registry dispatches by. Defaults to kind. */
    readonly editingKind?: string;
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

export type FieldValue<TField> = TField extends Field<infer TValue, string> ? TValue : never;

export type SearchableFieldKind = Extract<FieldKind, "text" | "markdown" | "richText" | "blocks">;

/** Fields whose values can be read cheaply in public Entry Summaries. */
export type SummaryFieldKind = Exclude<FieldKind, "markdown" | "richText" | "blocks">;

/** A field is nullable unless it was declared with `required: true`. */
export type Held<TValue, TOptions extends FieldOptions> = TOptions extends { required: true } ? TValue : TValue | null;

function base<const TKind extends FieldKind>(kind: TKind, options: FieldOptions | undefined) {
    return { kind, label: options?.label, description: options?.description, required: options?.required ?? false };
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
            slots: () => ({ value: slot({ affinity: "text", buildColumn: name => sqliteText(name) }) }),
            encode: (value: string) => ({ value }),
            decode: cells => cells.value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: string) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => raw.trim(),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: value => value === "",
            editingExtras: () => undefined,
            searchText: () => ({ type: "column-text", slot: "value" })
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
            slots: () => ({ value: slot({ affinity: "text", buildColumn: name => sqliteText(name) }) }),
            encode: (value: string) => ({ value }),
            decode: cells => cells.value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: string) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => raw,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: value => value === "",
            editingExtras: () => undefined,
            searchText: () => ({ type: "column-text", slot: "value" })
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
            slots: () => ({
                value: slot({
                    affinity: "text",
                    buildColumn: name => sqliteText(name, { mode: "json" }).$type<RichTextDocument>()
                })
            }),
            encode: (value: RichTextDocument) => ({ value: JSON.stringify(value) }),
            decode: cells => cells.value,
            snapshotValue: (value: RichTextDocument) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: RichTextDocument) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => JSON.parse(raw) as unknown,
            isBlankSubmission: raw => raw.length === 0,
            isRequiredValueMissing: value => isRichTextEmpty(value as RichTextDocument),
            editingExtras: () => undefined,
            searchText: () => ({ type: "rich-text", slot: "value" })
        }
    );
}

/**
 * Accepts either a BlockDocument or a legacy RichTextDocument, which predates
 * composable bodies and is wrapped into a single rich-text Block.
 */
export function parseBlocksValue(value: unknown, registry: BlockRegistry = {}): BlockDocument {
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return { version: 1, blocks: [] };
        }
    }

    if (
        typeof value === "object"
        && value !== null
        && !Array.isArray(value)
        && "type" in value
        && (value as { type?: unknown }).type === "doc"
    ) {
        // Legacy bodies are validated with the same rules the rich-text field
        // applied, so bad nodes keep being refused rather than silently kept.
        const document = parseRichText(value as RichTextDocument);

        return { version: 1, blocks: [{ id: "legacy-body", type: "builtin.richText", props: { document } }] };
    }

    return parseBlockDocument(value, registry).document;
}

export interface BlocksOptions extends FieldOptions {
    /** Worker-safe declarations used for validation and Search text projection. */
    registry?: BlockRegistry;
    /** Bump when a registered Block changes its Search projection. */
    searchVersion?: number;
}

/** A body composed of Blocks; Rich Text is one Block among others. */
export function blocks<const TOptions extends BlocksOptions = BlocksOptions>(
    options?: TOptions
): Field<Held<BlockDocument, TOptions>, "blocks"> {
    const definition = base("blocks", options);
    const registry = options?.registry ?? {};

    return compileField(
        { ...definition, editingKind: "blocks", parse: value => parseBlocksValue(value, registry) },
        {
            slots: () => ({
                value: slot({
                    affinity: "text",
                    buildColumn: name => sqliteText(name, { mode: "json" }).$type<BlockDocument>()
                }),
                plain: slot({ affinity: "text", buildColumn: name => sqliteText(name).$type<string>() })
            }),
            encode: (value: BlockDocument) => ({
                value: JSON.stringify(value),
                plain: blockPlainText(value, registry)
            }),
            decode: cells => cells.value,
            snapshotValue: (value: BlockDocument) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: BlockDocument) => value,
                value => value
            ),
            ...builtinContractVersions(),
            // The storage contract moved from one plain column (`body`) to a
            // `body__value` JSON column plus a `body__plain` search projection,
            // and the Search text expression moved from rich-text to the plain
            // column. Both contracts bump so migration tooling demands handoffs.
            storageVersion: () => 2,
            searchVersion: () => options?.searchVersion ?? 2,
            submissionValue: raw => JSON.parse(raw) as unknown,
            isBlankSubmission: raw => raw.length === 0,
            isRequiredValueMissing: value => {
                const document = value as BlockDocument;

                if (document.blocks.length === 0) {
                    return true;
                }

                // A body whose every block is an empty rich-text block reads
                // as visually empty, so it still does not satisfy `required`.
                return document.blocks.every(block => {
                    if (block.type !== "builtin.richText") {
                        return false;
                    }

                    const richText = block.props.document as RichTextDocument | undefined;

                    return richText === undefined || isRichTextEmpty(richText);
                });
            },
            editingExtras: () => undefined,
            searchText: () => ({ type: "column-text", slot: "plain" })
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
            slots: () => ({
                value: slot({
                    affinity: whole ? "integer" : "real",
                    buildColumn: name => (whole ? sqliteInteger(name) : sqliteReal(name))
                })
            }),
            encode: (value: number) => ({ value }),
            decode: cells => cells.value,
            snapshotValue: (value: number) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: number) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => Number(raw),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ whole }),
            searchText: () => undefined
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
            slots: () => ({
                value: slot({ affinity: "integer", buildColumn: name => sqliteInteger(name, { mode: "boolean" }) })
            }),
            encode: (value: boolean) => ({ value: value ? 1 : 0 }),
            decode: cells => cells.value,
            snapshotValue: (value: boolean) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: boolean) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw =>
                raw === "true" ? true
                : raw === "false" ? false
                : undefined,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined,
            searchText: () => undefined
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
            slots: () => ({
                value: slot({ affinity: "integer", buildColumn: name => sqliteInteger(name, { mode: "timestamp_ms" }) })
            }),
            encode: (value: Date) => ({ value: value.getTime() }),
            decode: cells => cells.value,
            snapshotValue: (value: Date) => value.getTime(),
            valueFromSnapshot: value => (typeof value === "number" ? new Date(value) : value),
            ...revisionCodecV1(
                (value: Date) => value.getTime(),
                value => (typeof value === "number" ? new Date(value) : value)
            ),
            ...builtinContractVersions(),
            submissionValue: raw => new Date(raw),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => undefined,
            searchText: () => undefined
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
            slots: () => ({
                value: slot({
                    affinity: "text",
                    buildColumn: name => sqliteText(name, { enum: options.of as [TChoice, ...TChoice[]] })
                })
            }),
            encode: (value: string) => ({ value }),
            decode: cells => cells.value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: string) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => raw,
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ choices: options.of }),
            searchText: () => undefined
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
            slots: () => ({ value: slot({ affinity: "text", buildColumn: name => sqliteText(name) }) }),
            encode: (value: string) => ({ value }),
            decode: cells => cells.value,
            snapshotValue: (value: string) => value,
            valueFromSnapshot: value => value,
            ...revisionCodecV1(
                (value: string) => value,
                value => value
            ),
            ...builtinContractVersions(),
            submissionValue: raw => raw.trim(),
            isBlankSubmission: raw => raw.trim().length === 0,
            isRequiredValueMissing: () => false,
            editingExtras: () => ({ collection: options.to }),
            searchText: () => undefined
        }
    );
}

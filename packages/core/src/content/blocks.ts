import { parseColor } from "../theme";
import { emptyRichText, parseRichText, richTextPlainText, safeRichTextHref, type RichTextDocument } from "./rich-text";

/**
 * The Block layer of the content model (iteration epic #26, milestone #29).
 *
 * A Block is a self-contained unit of a composable body: it declares the
 * attributes an author may set, and the platform validates every instance
 * against that declaration before it is stored. Rendering belongs to the Site
 * and its editor packages; the core owns types, validation, and interchange.
 */

/** The attribute kinds a Block declaration may expose. */
export type BlockPropKind = "text" | "number" | "flag" | "color" | "mediaId" | "richText" | "choice" | "link";

export interface BlockPropDeclaration {
    kind: BlockPropKind;
    label: string;
    description?: string;
    default?: unknown;
    /** Accepted values for choice attributes. Required only for that kind. */
    choices?: readonly string[];
}

export type BlockPropsSchema = Record<string, BlockPropDeclaration>;

export interface BlockDefinition {
    /** Globally unique name, namespaced like settings: "builtin.heading". */
    name: string;
    label: string;
    description?: string;
    props: BlockPropsSchema;
    /** Says why an otherwise well-shaped instance still will not do. */
    check?: (props: Record<string, unknown>) => string | undefined;
    /** Reader-facing text that enters full-text search. */
    plainText?: (props: Record<string, unknown>) => string;
}

/**
 * One concrete Block inside a composable body. `id` is unique within the
 * document it appears in, so canvas state and revisions can address it.
 */
export interface BlockInstance {
    id: string;
    type: string;
    props: Record<string, unknown>;
}

export interface BlockDocument {
    version: 1;
    blocks: BlockInstance[];
}

export function defineBlock<const TDefinition extends BlockDefinition>(definition: TDefinition): TDefinition {
    for (const [name, declaration] of Object.entries(definition.props)) {
        if (declaration.kind === "choice" && (!declaration.choices || declaration.choices.length === 0)) {
            throw new Error(`Block "${definition.name}": the choice attribute "${name}" needs choices.`);
        }

        if (declaration.kind !== "choice" && declaration.choices !== undefined) {
            throw new Error(`Block "${definition.name}": only choice attributes may declare choices.`);
        }
    }

    return definition;
}

function isText(value: unknown): value is string {
    return typeof value === "string";
}

function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isFlag(value: unknown): value is boolean {
    return typeof value === "boolean";
}

function isMediaId(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

export function checkPropValue(kindOrDeclaration: BlockPropKind | BlockPropDeclaration, value: unknown): boolean {
    const declaration: Pick<BlockPropDeclaration, "kind" | "choices"> =
        typeof kindOrDeclaration === "string" ? { kind: kindOrDeclaration } : kindOrDeclaration;

    const { kind } = declaration;

    switch (kind) {
        case "text":
            return isText(value);
        case "number":
            return isNumber(value);
        case "flag":
            return isFlag(value);
        case "color":
            return isText(value) && parseColor(value) !== undefined;
        case "mediaId":
            return isMediaId(value);
        case "richText": {
            try {
                parseRichText(value);
                return true;
            } catch {
                return false;
            }
        }
        case "choice":
            return typeof value === "string" && Boolean(declaration.choices?.includes(value));
        case "link":
            return typeof value === "string" && safeRichTextHref(value) !== undefined;
    }
}

export interface BlockValidation {
    ok: boolean;
    props: Record<string, unknown>;
    errors: string[];
}

/** Fills defaults and reports every attribute that does not match its declaration. */
export function validateBlockProps(definition: BlockDefinition, raw: unknown): BlockValidation {
    const props: Record<string, unknown> = {};
    const errors: string[] = [];

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, props, errors: ["Block attributes must be an object."] };
    }

    const record = raw as Record<string, unknown>;

    for (const [key, declaration] of Object.entries(definition.props)) {
        const value = record[key] ?? declaration.default;

        if (value === undefined || !checkPropValue(declaration, value)) {
            errors.push(
                `"${key}" expects ${
                    declaration.kind === "mediaId" ? "a media id"
                    : declaration.kind === "richText" ? "a rich-text document"
                    : declaration.kind === "choice" ? "one of its declared choices"
                    : declaration.kind === "link" ? "a safe address"
                    : `a ${declaration.kind}`
                }.`
            );
            continue;
        }

        props[key] = declaration.kind === "richText" ? parseRichText(value) : value;
    }

    for (const key of Object.keys(record)) {
        if (definition.props[key] === undefined) {
            errors.push(`"${key}" is not declared on ${definition.name}.`);
        }
    }

    const check = definition.check?.(props);

    if (check !== undefined) {
        errors.push(check);
    }

    return { ok: errors.length === 0, props, errors };
}

export interface BlockDocumentParse {
    ok: boolean;
    document: BlockDocument;
    errors: string[];
}

/**
 * Validates a stored body against a registry. Unknown block types are kept in
 * the document and reported, so nothing is destroyed by a missing plugin.
 */
export function parseBlockDocument(raw: unknown, registry: BlockRegistry): BlockDocumentParse {
    const errors: string[] = [];

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, document: { version: 1, blocks: [] }, errors: ["A body must be an object."] };
    }

    const record = raw as Record<string, unknown>;

    if (record.version !== 1 || !Array.isArray(record.blocks)) {
        return { ok: false, document: { version: 1, blocks: [] }, errors: ["Unsupported body format."] };
    }

    const blocks: BlockInstance[] = [];
    const ids = new Set<string>();

    for (const item of record.blocks) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            errors.push("A block must be an object.");
            continue;
        }

        const block = item as Record<string, unknown>;

        if (typeof block.id !== "string" || block.id.trim() === "" || typeof block.type !== "string") {
            errors.push("Every block needs an id and a type.");
            continue;
        }

        if (ids.has(block.id)) {
            errors.push(`Block id "${block.id}" is used more than once.`);
            continue;
        }

        ids.add(block.id);

        const definition = registry[block.type];

        if (definition === undefined) {
            errors.push(`Unknown block type "${block.type}".`);
            blocks.push({ id: block.id, type: block.type, props: (block.props as Record<string, unknown>) ?? {} });
            continue;
        }

        const validated = validateBlockProps(definition, block.props);

        if (!validated.ok) {
            errors.push(...validated.errors.map(error => `${definition.label}: ${error}`));
        }

        blocks.push({ id: block.id, type: block.type, props: validated.props });
    }

    return { ok: errors.length === 0, document: { version: 1, blocks }, errors };
}

/** All Blocks a Site has registered, addressed by name. */
export type BlockRegistry = Record<string, BlockDefinition>;

/**
 * Extracts the Rich Text block a composable body carries. Bodies written before
 * composability existed are wrapped into exactly one such block, so this is the
 * stable view a Rich Text editor edits.
 */
export function blocksToRichText(document: BlockDocument | RichTextDocument): RichTextDocument {
    if (!Array.isArray((document as BlockDocument).blocks)) {
        // Revisions written before composable bodies stored the rich text
        // directly, so the snapshot value itself is already the document.
        const candidate = document as unknown as Record<string, unknown>;

        if (typeof candidate === "object" && candidate !== null && candidate.type === "doc") {
            return document as unknown as RichTextDocument;
        }

        return emptyRichText();
    }

    for (const block of (document as BlockDocument).blocks) {
        if (block.type === "builtin.richText") {
            const candidate = (block.props as Record<string, unknown>).document;

            if (typeof candidate === "object" && candidate !== null && "type" in candidate) {
                return candidate as unknown as RichTextDocument;
            }
        }
    }

    return emptyRichText();
}

/** Joins the reader-facing text of every block, for search indexing. */
export function blockPlainText(document: BlockDocument, registry: BlockRegistry = {}): string {
    const parts: string[] = [];

    for (const block of document.blocks) {
        const definition = registry[block.type];
        const projection = definition?.plainText;

        if (projection !== undefined) {
            const text = projection(block.props).trim();

            if (text) {
                parts.push(text);
            }

            continue;
        }

        if (definition !== undefined) {
            continue;
        }

        const props = block.props as Record<string, unknown>;

        for (const value of Object.values(props)) {
            if (typeof value === "string" && value.length > 0) {
                parts.push(value);
            } else if (typeof value === "object" && value !== null && !Array.isArray(value) && "type" in value) {
                parts.push(richTextPlainText(value as unknown as RichTextDocument));
            }
        }
    }

    return parts.join(" ");
}

import { parseColor } from "../theme";

/**
 * The Block layer of the content model (iteration epic #26, milestone #29).
 *
 * A Block is a self-contained unit of a composable body: it declares the
 * attributes an author may set, and the platform validates every instance
 * against that declaration before it is stored. Rendering belongs to the Site
 * and its editor packages; the core owns types, validation, and interchange.
 */

/** The attribute kinds a Block declaration may expose. */
export type BlockPropKind = "text" | "number" | "flag" | "color" | "mediaId" | "richText";

export interface BlockPropDeclaration {
    kind: BlockPropKind;
    label: string;
    description?: string;
    default?: unknown;
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

export function defineBlock(definition: BlockDefinition): BlockDefinition {
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

export function checkPropValue(kind: BlockPropKind, value: unknown): boolean {
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
        case "richText":
            return typeof value === "object" && value !== null && !Array.isArray(value);
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

        if (value === undefined || !checkPropValue(declaration.kind, value)) {
            errors.push(
                `"${key}" expects ${
                    declaration.kind === "mediaId" ? "a media id"
                    : declaration.kind === "richText" ? "a rich-text document"
                    : `a ${declaration.kind}`
                }.`
            );
            continue;
        }

        props[key] = value;
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

    for (const item of record.blocks) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            errors.push("A block must be an object.");
            continue;
        }

        const block = item as Record<string, unknown>;

        if (typeof block.id !== "string" || typeof block.type !== "string") {
            errors.push("Every block needs an id and a type.");
            continue;
        }

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

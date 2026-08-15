export type RichTextMarkType = "bold" | "italic" | "strike" | "code" | "link";

export interface RichTextMark {
    type: RichTextMarkType;
    attrs?: { href: string };
}

export type RichTextNodeType =
    | "doc"
    | "paragraph"
    | "text"
    | "heading"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "codeBlock"
    | "horizontalRule"
    | "hardBreak"
    | "mediaImage";

export interface RichTextNode {
    type: RichTextNodeType;
    attrs?: Record<string, string | number | null>;
    content?: RichTextNode[];
    marks?: RichTextMark[];
    text?: string;
}

export interface RichTextDocument extends RichTextNode {
    type: "doc";
    content: RichTextNode[];
}

export interface RichTextRenderOptions {
    mediaAddress?(mediaId: string): string | undefined;
    headingId?(heading: { level: number; text: string }): string | undefined;
}

const BLOCK_NODES = new Set<RichTextNodeType>([
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "mediaImage"
]);
const INLINE_NODES = new Set<RichTextNodeType>(["text", "hardBreak"]);
const LEAF_NODES = new Set<RichTextNodeType>(["horizontalRule", "hardBreak", "mediaImage"]);
const MARKS = new Set<RichTextMarkType>(["bold", "italic", "strike", "code", "link"]);
const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 100;
const MAX_NODES = 10_000;

interface ParseState {
    nodes: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value) ?
            (value as Record<string, unknown>)
        :   undefined;
}

function onlyAttributes(attrs: Record<string, unknown> | undefined, allowed: readonly string[], type: string) {
    const unsupported = Object.keys(attrs ?? {}).find(attribute => !allowed.includes(attribute));

    if (unsupported !== undefined) {
        throw new Error(`Unsupported rich text ${type} attribute: ${unsupported}.`);
    }
}

function attrsFor(type: RichTextNodeType, value: unknown): RichTextNode["attrs"] {
    const attrs = record(value);

    if (type === "heading") {
        onlyAttributes(attrs, ["level"], type);
        const level = attrs?.level;

        if (typeof level !== "number" || !Number.isSafeInteger(level) || level < 1 || level > 6) {
            throw new Error("A rich text heading needs a level from 1 to 6.");
        }

        return { level };
    }

    if (type === "orderedList") {
        onlyAttributes(attrs, ["start"], type);
        const start = attrs?.start ?? 1;

        if (typeof start !== "number" || !Number.isSafeInteger(start) || start < 1) {
            throw new Error("A rich text ordered list needs a positive starting number.");
        }

        return { start };
    }

    if (type === "codeBlock") {
        onlyAttributes(attrs, ["language"], type);
        const language = attrs?.language;

        if (language !== undefined && language !== null && typeof language !== "string") {
            throw new Error("A rich text code block language must be text.");
        }

        return { language: typeof language === "string" && language ? language : null };
    }

    if (type === "mediaImage") {
        onlyAttributes(attrs, ["mediaId", "alt"], type);
        const mediaId = attrs?.mediaId;
        const alt = attrs?.alt;

        if (typeof mediaId !== "string" || !MEDIA_ID.test(mediaId.trim())) {
            throw new Error("A rich text Media image needs a Media identifier.");
        }

        if (alt !== undefined && typeof alt !== "string") {
            throw new Error("A rich text Media image alternative must be text.");
        }

        return { mediaId: mediaId.trim(), alt: typeof alt === "string" ? alt : "" };
    }

    return undefined;
}

export function safeRichTextHref(value: string): string | undefined {
    const href = value.trim();

    if (href.startsWith("#") || href.startsWith("./") || href.startsWith("../")) {
        return href;
    }

    if (href.startsWith("/") && !href.startsWith("//")) {
        return href;
    }

    try {
        const protocol = new URL(href).protocol;

        return ["http:", "https:", "mailto:", "tel:"].includes(protocol) ? href : undefined;
    } catch {
        return undefined;
    }
}

function markFrom(value: unknown): RichTextMark {
    const candidate = record(value);

    if (candidate === undefined) {
        throw new Error("A rich text mark must be an object.");
    }

    const type = candidate?.type;

    if (typeof type !== "string" || !MARKS.has(type as RichTextMarkType)) {
        throw new Error(`Unsupported rich text mark: ${String(type)}.`);
    }

    if (type === "link") {
        const href = record(candidate.attrs)?.href;

        if (typeof href !== "string" || !safeRichTextHref(href)) {
            throw new Error("A rich text link needs an address.");
        }

        return { type, attrs: { href: safeRichTextHref(href)! } };
    }

    return { type: type as RichTextMarkType };
}

function withoutNodeContent(candidate: Record<string, unknown>, type: RichTextNodeType, allowMarks = false) {
    if (
        candidate.content !== undefined
        || candidate.text !== undefined
        || (!allowMarks && candidate.marks !== undefined)
    ) {
        throw new Error(`A rich text ${type} node cannot carry content.`);
    }
}

function childrenFrom(
    candidate: Record<string, unknown>,
    type: RichTextNodeType,
    state: ParseState,
    depth: number
): RichTextNode[] {
    const content = candidate.content;

    if (content !== undefined && !Array.isArray(content)) {
        throw new Error(`A rich text ${type} node has invalid content.`);
    }

    return Array.isArray(content) ? content.map(child => nodeFrom(child, state, depth + 1)) : [];
}

function requireChildren(type: RichTextNodeType, children: RichTextNode[], allowed: Set<RichTextNodeType>) {
    if (children.length === 0 || children.some(child => !allowed.has(child.type))) {
        throw new Error(`A rich text ${type} node has invalid children.`);
    }
}

function validateChildren(type: RichTextNodeType, children: RichTextNode[]) {
    if (type === "doc" || type === "blockquote") {
        requireChildren(type, children, BLOCK_NODES);
        return;
    }

    if (type === "paragraph" || type === "heading") {
        if (children.some(child => !INLINE_NODES.has(child.type))) {
            throw new Error(`A rich text ${type} node has invalid children.`);
        }
        return;
    }

    if (type === "bulletList" || type === "orderedList") {
        requireChildren(type, children, new Set<RichTextNodeType>(["listItem"]));
        return;
    }

    if (type === "listItem") {
        if (
            children.length === 0
            || children[0]?.type !== "paragraph"
            || children.slice(1).some(child => !BLOCK_NODES.has(child.type))
        ) {
            throw new Error("A rich text listItem node has invalid children.");
        }
        return;
    }

    if (type === "codeBlock" && children.some(child => child.type !== "text" || Boolean(child.marks?.length))) {
        throw new Error("A rich text codeBlock node has invalid children.");
    }
}

function nodeFrom(value: unknown, state: ParseState, depth: number): RichTextNode {
    if (depth > MAX_DEPTH) {
        throw new Error("A rich text body is nested too deeply.");
    }

    state.nodes += 1;

    if (state.nodes > MAX_NODES) {
        throw new Error("A rich text body has too many nodes.");
    }

    const candidate = record(value);

    if (candidate === undefined) {
        throw new Error("A rich text node must be an object.");
    }

    const type = candidate?.type;

    if (typeof type !== "string") {
        throw new Error("A rich text node needs a type.");
    }

    if (type === "text") {
        if (typeof candidate.text !== "string" || candidate.text.length === 0) {
            throw new Error("A rich text text node needs text.");
        }

        const marks = candidate.marks;

        if (
            candidate.content !== undefined
            || candidate.attrs !== undefined
            || (marks !== undefined && !Array.isArray(marks))
        ) {
            throw new Error("A rich text text node has invalid properties.");
        }

        return {
            type,
            text: candidate.text,
            ...(Array.isArray(marks) && marks.length > 0 ? { marks: marks.map(markFrom) } : {})
        };
    }

    if (LEAF_NODES.has(type as RichTextNodeType)) {
        const leafType = type as RichTextNodeType;

        withoutNodeContent(candidate, leafType, leafType === "hardBreak");
        const attrs = attrsFor(type as RichTextNodeType, candidate.attrs);
        const marks = candidate.marks;

        if (marks !== undefined && !Array.isArray(marks)) {
            throw new Error(`A rich text ${type} node has invalid marks.`);
        }

        return {
            type: leafType,
            ...(attrs ? { attrs } : {}),
            ...(leafType === "hardBreak" && Array.isArray(marks) && marks.length > 0 ?
                { marks: marks.map(markFrom) }
            :   {})
        };
    }

    const container = type as RichTextNodeType;

    if (
        container === "doc"
        || container === "paragraph"
        || container === "heading"
        || container === "bulletList"
        || container === "orderedList"
        || container === "listItem"
        || container === "blockquote"
        || container === "codeBlock"
    ) {
        if (candidate.text !== undefined || candidate.marks !== undefined) {
            throw new Error(`A rich text ${type} node has invalid properties.`);
        }

        const content = childrenFrom(candidate, container, state, depth);
        const attrs = attrsFor(container, candidate.attrs);

        validateChildren(container, content);

        return {
            type: container,
            ...(attrs ? { attrs } : {}),
            ...(content.length > 0 || container === "doc" ? { content } : {})
        };
    }

    throw new Error(`Unsupported rich text node: ${type}.`);
}

export function parseRichText(value: unknown): RichTextDocument {
    let candidate = value;

    if (typeof value === "string") {
        try {
            candidate = JSON.parse(value) as unknown;
        } catch {
            throw new Error("A rich text body must be valid JSON.");
        }
    }

    const document = nodeFrom(candidate, { nodes: 0 }, 0);

    if (document.type !== "doc") {
        throw new Error("A rich text body must start with a doc node.");
    }

    return document as RichTextDocument;
}

/**
 * Walks a document into a searchable word stream. Text nodes that split one
 * word across marks stay joined, block boundaries and hard breaks become word
 * separators, and media alternative text is indexed alongside the words.
 */
export function richTextPlainText(document: RichTextDocument): string {
    const parts: string[] = [];
    let run = "";

    const flush = (): void => {
        if (run.length > 0) {
            parts.push(run);
            run = "";
        }
    };

    function visit(node: RichTextNode): void {
        if (node.type === "text") {
            run += node.text ?? "";
            return;
        }

        if (node.type === "hardBreak") {
            flush();
            return;
        }

        if (node.type === "mediaImage") {
            flush();
            const alt = node.attrs?.alt;

            if (typeof alt === "string" && alt.length > 0) {
                parts.push(alt);
            }
            return;
        }

        for (const child of node.content ?? []) {
            visit(child);
        }

        if (node.type !== "doc" && node.type !== "paragraph") {
            flush();
        }
    }

    visit(document);
    flush();

    return parts.join(" ");
}

export function emptyRichText(): RichTextDocument {
    return { type: "doc", content: [{ type: "paragraph" }] };
}

export function richTextFromPlainText(text: string): RichTextDocument {
    return text ?
            { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }
        :   emptyRichText();
}

function hasContent(node: RichTextNode): boolean {
    if (node.type === "text") {
        return Boolean(node.text?.trim());
    }

    if (node.type === "mediaImage" || node.type === "horizontalRule") {
        return true;
    }

    return node.content?.some(hasContent) ?? false;
}

export function isRichTextEmpty(document: RichTextDocument): boolean {
    return !hasContent(document);
}

function plainText(node: RichTextNode): string {
    if (node.type === "text") {
        return node.text ?? "";
    }

    if (node.type === "hardBreak") {
        return "\n";
    }

    if (node.type === "mediaImage") {
        return typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
    }

    const separator = ["doc", "bulletList", "orderedList", "blockquote"].includes(node.type) ? "\n" : "";

    return (node.content ?? []).map(plainText).filter(Boolean).join(separator);
}

export function richTextToPlainText(document: RichTextDocument): string {
    return plainText(document).trim();
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderMarks(text: string, marks: RichTextMark[] = []): string {
    return marks.reduce((content, mark) => {
        if (mark.type === "bold") return `<strong>${content}</strong>`;
        if (mark.type === "italic") return `<em>${content}</em>`;
        if (mark.type === "strike") return `<s>${content}</s>`;
        if (mark.type === "code") return `<code>${content}</code>`;

        const href = mark.attrs?.href ? safeRichTextHref(mark.attrs.href) : undefined;
        return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${content}</a>` : content;
    }, text);
}

function renderNode(node: RichTextNode, options: RichTextRenderOptions): string {
    if (node.type === "text") {
        return renderMarks(escapeHtml(node.text ?? "").replaceAll("\n", "<br>"), node.marks);
    }

    if (node.type === "hardBreak") return "<br>";
    if (node.type === "horizontalRule") return "<hr>";

    if (node.type === "mediaImage") {
        const mediaId = typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : "";
        const address = options.mediaAddress?.(mediaId);

        if (!address) return "";

        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
        return `<figure><img src="${escapeHtml(address)}" alt="${escapeHtml(alt)}" loading="lazy"></figure>`;
    }

    if (node.type === "codeBlock") {
        const language =
            typeof node.attrs?.language === "string" ? ` class="language-${escapeHtml(node.attrs.language)}"` : "";
        const content = (node.content ?? []).map(child => escapeHtml(child.text ?? "")).join("");

        return `<pre><code${language}>${content}</code></pre>`;
    }

    const content = (node.content ?? []).map(child => renderNode(child, options)).join("");

    if (node.type === "doc") return content;
    if (node.type === "paragraph") return `<p>${content}</p>`;
    if (node.type === "heading") {
        const level = node.attrs?.level as number;
        const id = options.headingId?.({ level, text: plainText(node).trim() });
        const attribute = id ? ` id="${escapeHtml(id)}"` : "";

        return `<h${level}${attribute}>${content}</h${level}>`;
    }
    if (node.type === "bulletList") return `<ul>${content}</ul>`;
    if (node.type === "orderedList") {
        const start = node.attrs?.start;
        return typeof start === "number" ? `<ol start="${start}">${content}</ol>` : `<ol>${content}</ol>`;
    }
    if (node.type === "listItem") return `<li>${content}</li>`;
    if (node.type === "blockquote") return `<blockquote>${content}</blockquote>`;
    return "";
}

export function renderRichTextToHtml(document: RichTextDocument, options: RichTextRenderOptions = {}): string {
    return renderNode(parseRichText(document), options);
}

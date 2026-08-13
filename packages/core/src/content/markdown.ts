import { parseRichText, safeRichTextHref, type RichTextDocument, type RichTextNode } from "./rich-text";

/**
 * Converts repository Markdown into Rich Text. This is a deliberate subset:
 * headings, paragraphs, bullet and ordered lists, block quotes, fenced code
 * blocks, horizontal rules, and inline code, bold, italic, and links. Markdown
 * tables become a bullet list of pipe-joined rows because Rich Text has no
 * table node yet.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const HORIZONTAL_RULE = /^\s*(-{3,}|\*{3,})\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+\.\s+(.*)$/;
const QUOTE = /^(\s*)>\s?(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
const FENCE = /^\s*```\s*(\S*)\s*$/;

const CODE_SPAN = /`([^`\n]+)`/;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/;
const BOLD = /\*\*([^*\n]+)\*\*/;
const ITALIC = /\*([^*\n]+)\*/;

function paragraph(lines: string[]): RichTextNode {
    return { type: "paragraph", content: inlineNodes(lines.join(" ")) };
}

function inlineNodes(text: string): RichTextNode[] {
    const nodes: RichTextNode[] = [];
    let position = 0;

    while (position < text.length) {
        const code = CODE_SPAN.exec(text.slice(position));
        const link = LINK.exec(text.slice(position));
        const bold = BOLD.exec(text.slice(position));
        const italic = ITALIC.exec(text.slice(position));

        const match = earliest([
            code === null ? undefined : { start: code.index, length: code[0].length, make: () => codeNode(code[1]!) },
            link === null ? undefined : (
                { start: link.index, length: link[0].length, make: () => linkNode(link[1]!, link[2]!) }
            ),
            bold === null ? undefined : (
                { start: bold.index, length: bold[0].length, make: () => markNode(bold[1]!, "bold") }
            ),
            italic === null ? undefined : (
                { start: italic.index, length: italic[0].length, make: () => markNode(italic[1]!, "italic") }
            )
        ]);

        if (match === undefined) {
            nodes.push({ type: "text", text: text.slice(position) });
            break;
        }

        if (match.start > 0) {
            nodes.push({ type: "text", text: text.slice(position, position + match.start) });
        }

        const made = match.make();

        if (Array.isArray(made)) {
            nodes.push(...made);
        } else {
            nodes.push(made);
        }

        position += match.start + match.length;
    }

    return nodes;
}

interface InlineMatch {
    start: number;
    length: number;
    make: () => RichTextNode | RichTextNode[];
}

function earliest(matches: (InlineMatch | undefined)[]): InlineMatch | undefined {
    let best: InlineMatch | undefined;

    for (const match of matches) {
        if (match !== undefined && (best === undefined || match.start < best.start)) {
            best = match;
        }
    }

    return best;
}

function codeNode(code: string): RichTextNode {
    return { type: "text", text: code, marks: [{ type: "code" }] };
}

function linkNode(label: string, href: string): RichTextNode {
    const safe = safeRichTextHref(href);

    return safe === undefined ?
            { type: "text", text: label }
        :   { type: "text", text: label, marks: [{ type: "link", attrs: { href: safe } }] };
}

function markNode(text: string, type: "bold" | "italic"): RichTextNode[] {
    return inlineNodes(text).map(node =>
        node.type === "text" ? { ...node, marks: [...(node.marks ?? []), { type }] } : node
    );
}

/** Renders a Markdown table row as one bullet list item of pipe-joined cells. */
function tableRowNode(cells: readonly string[]): RichTextNode {
    return { type: "listItem", content: [{ type: "paragraph", content: inlineNodes(cells.join(" | ")) }] };
}

export function richTextFromMarkdown(markdown: string): RichTextDocument {
    const lines = markdown.replaceAll("\r\n", "\n").split("\n");
    const content: RichTextNode[] = [];
    let index = 0;

    /** [indent, listNode] pairs for the currently open list levels. */
    const listStack: { indent: number; node: RichTextNode }[] = [];
    let paragraphBuffer: string[] | undefined;

    function closeParagraph(): void {
        flushParagraph();
        listStack.length = 0;
    }

    function flushParagraph(): void {
        if (paragraphBuffer !== undefined) {
            content.push(paragraph(paragraphBuffer));
            paragraphBuffer = undefined;
        }
    }

    function appendListItem(markupIndent: number, type: "bulletList" | "orderedList", lineText: string): void {
        while (listStack.length > 0 && listStack[listStack.length - 1]!.indent > markupIndent) {
            listStack.pop();
        }

        const top = listStack[listStack.length - 1];

        if (top !== undefined && top.indent === markupIndent && top.node.type !== type) {
            listStack.pop();
        }

        const item = {
            type: "listItem",
            content: [{ type: "paragraph", content: inlineNodes(lineText) }]
        } satisfies RichTextNode;

        if (listStack.length === 0 || listStack[listStack.length - 1]!.indent < markupIndent) {
            const list = { type, content: [item] } satisfies RichTextNode;

            if (listStack.length === 0) {
                content.push(list);
            } else {
                const parent = listStack[listStack.length - 1]!.node;
                const lastItem = parent.content?.[parent.content.length - 1];

                if (lastItem === undefined || lastItem.type !== "listItem") {
                    throw new Error(`Markdown nesting ends on a ${lastItem?.type ?? "missing"} node.`);
                }

                (lastItem.content ??= []).push(list);
            }

            listStack.push({ indent: markupIndent, node: list });
            return;
        }

        listStack[listStack.length - 1]!.node.content!.push(item);
    }

    while (index < lines.length) {
        const line = lines[index]!;

        if (line.trim() === "") {
            closeParagraph();
            index += 1;
            continue;
        }

        const fence = FENCE.exec(line);

        if (fence !== null) {
            closeParagraph();
            const language = fence[1] || null;
            const code: string[] = [];
            index += 1;

            while (index < lines.length && !/^\s*```/.test(lines[index]!)) {
                code.push(lines[index]!);
                index += 1;
            }

            index += 1; // skip the closing fence (or the end of input)
            content.push({
                type: "codeBlock",
                attrs: { language },
                content: code.length === 0 ? [] : [{ type: "text", text: `${code.join("\n")}\n` }]
            });
            continue;
        }

        const heading = HEADING.exec(line);

        if (heading !== null) {
            closeParagraph();
            content.push({ type: "heading", attrs: { level: heading[1]!.length }, content: inlineNodes(heading[2]!) });
            index += 1;
            continue;
        }

        if (HORIZONTAL_RULE.test(line)) {
            closeParagraph();
            content.push({ type: "horizontalRule" });
            index += 1;
            continue;
        }

        const bullet = BULLET.exec(line);
        const ordered = ORDERED.exec(line);

        if (bullet !== null || ordered !== null) {
            flushParagraph();
            const matched = (bullet ?? ordered)!;
            appendListItem(matched[1]!.length, bullet !== null ? "bulletList" : "orderedList", matched[2]!);
            index += 1;
            continue;
        }

        const quote = QUOTE.exec(line);

        if (quote !== null) {
            closeParagraph();
            const quoted: string[] = [quote[2] ?? ""];
            index += 1;

            while (index < lines.length) {
                const nextQuote = QUOTE.exec(lines[index]!);

                if (nextQuote === null || lines[index]!.trim() === "") {
                    break;
                }

                quoted.push(nextQuote[2] ?? "");
                index += 1;
            }

            content.push({ type: "blockquote", content: [paragraph(quoted)] });
            continue;
        }

        if (TABLE_ROW.test(line)) {
            closeParagraph();
            const table: { type: "bulletList"; content: RichTextNode[] } = { type: "bulletList", content: [] };

            while (index < lines.length && TABLE_ROW.test(lines[index]!)) {
                const cells = lines[index]!.trim()
                    .replace(/^\|/, "")
                    .replace(/\|$/, "")
                    .split("|")
                    .map(cell => cell.trim());

                if (!TABLE_SEPARATOR.test(lines[index]!)) {
                    table.content.push(tableRowNode(cells));
                }

                index += 1;
            }

            content.push(table);
            continue;
        }

        if (paragraphBuffer === undefined) {
            paragraphBuffer = [];
        }

        paragraphBuffer.push(line.trim());
        index += 1;
    }

    closeParagraph();

    return parseRichText({ type: "doc", content });
}

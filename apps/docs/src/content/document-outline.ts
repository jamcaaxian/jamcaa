import {
    richTextToPlainText,
    type BlockDocument,
    type RichTextDocument,
    type RichTextNode
} from "@jamcaaxian/core/content";

export interface DocumentHeading {
    id: string;
    level: number;
    text: string;
}

function baseHeadingId(text: string): string {
    const id = text
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "");

    return id || "section";
}

export function headingIdFactory(): (heading: { level: number; text: string }) => string {
    const counts = new Map<string, number>();

    return ({ text }) => {
        const base = baseHeadingId(text);
        const count = (counts.get(base) ?? 0) + 1;
        counts.set(base, count);

        return count === 1 ? base : `${base}-${count}`;
    };
}

function nodeText(node: RichTextNode): string {
    return node.type === "text" ? (node.text ?? "") : (node.content ?? []).map(nodeText).join("");
}

function richTextHeadings(document: RichTextDocument): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];

    function visit(node: RichTextNode) {
        if (node.type === "heading") {
            const level = node.attrs?.level;
            const text = nodeText(node).trim();

            if (typeof level === "number" && text) {
                headings.push({ level, text });
            }
        }

        for (const child of node.content ?? []) {
            visit(child);
        }
    }

    visit(document);

    return headings;
}

export function documentOutline(document: BlockDocument): DocumentHeading[] {
    const pending: Array<{ level: number; text: string }> = [];

    for (const block of document.blocks) {
        if (block.type === "builtin.heading") {
            const text = String(block.props.text ?? "").trim();
            const level = Number(block.props.level ?? 2);

            if (text) {
                pending.push({ level, text });
            }
        }

        if (block.type === "builtin.richText") {
            const candidate = block.props.document as RichTextDocument | undefined;

            if (candidate?.type === "doc") {
                pending.push(...richTextHeadings(candidate));
            }
        }
    }

    const idFor = headingIdFactory();

    return pending.map(heading => ({ ...heading, id: idFor(heading) }));
}

export function documentReadingText(document: BlockDocument): string {
    return document.blocks
        .map(block => {
            if (block.type === "builtin.richText") {
                const candidate = block.props.document as RichTextDocument | undefined;

                return candidate?.type === "doc" ? richTextToPlainText(candidate) : "";
            }

            return Object.values(block.props)
                .filter(value => typeof value === "string")
                .join(" ");
        })
        .join(" ")
        .trim();
}

import { richTextFromMarkdown, type RichTextDocument } from "@jamcaa/core/content";
import { entryStore } from "@jamcaa/core/content";
import type { Collection, ContentModel } from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";

/** One repository document, ready to become one published Post. */
export interface DocSource {
    /** Stable Entry slug; the migration's identity for the document. */
    slug: string;
    title: string;
    markdown: string;
}

export interface MigrateDocsContentResult {
    created: number;
    updated: number;
}

/** The path a document had in the repository, minus its .md suffix. */
export function docSlug(relativePath: string): string {
    const normalized = relativePath.replaceAll("\\", "/");
    const base = normalized.split("/").pop()?.replace(/\.md$/i, "") ?? normalized;

    if (normalized === "CONTEXT.md") {
        return "context";
    }

    if (normalized === "README.md") {
        return "readme";
    }

    if (normalized.startsWith("docs/adr/")) {
        return `adr-${base}`;
    }

    if (normalized.startsWith("docs/agents/")) {
        return `agents-${base}`;
    }

    return base.toLowerCase();
}

function firstHeading(markdown: string, fallback: string): string {
    const match = /^#\s+(.+)$/m.exec(markdown);

    return match === null ? fallback : match[1]!.trim();
}

function firstParagraphText(body: RichTextDocument): string {
    for (const node of body.content) {
        if (node.type !== "paragraph") {
            continue;
        }

        const text = (node.content ?? [])
            .map(child => (child.type === "text" ? (child.text ?? "") : " "))
            .join("")
            .trim();

        if (text) {
            return text.slice(0, 200);
        }
    }

    return "";
}

/**
 * Writes repository Markdown documents as published Posts. Documents are
 * identified by slug, so re-running replaces existing Entries instead of
 * duplicating them.
 */
export async function migrateDocsContent(options: {
    database: Database;
    collection: Collection;
    table: ContentModel["tables"][string];
    authorId: string;
    categoryId: string;
    sources: readonly DocSource[];
}): Promise<MigrateDocsContentResult> {
    const { database, collection, table, authorId, categoryId } = options;
    const store = entryStore({ database, collection, table });
    let created = 0;
    let updated = 0;

    for (const source of [...options.sources].sort((left, right) => left.slug.localeCompare(right.slug))) {
        const body = richTextFromMarkdown(source.markdown);
        const title = source.title || firstHeading(source.markdown, source.slug);
        const excerpt = firstParagraphText(body);
        const existing = await store.bySlug(source.slug);

        if (existing === undefined) {
            await store.create({
                slug: source.slug,
                authorId,
                categoryId,
                status: "published",
                publishedAt: new Date(),
                title,
                excerpt,
                body
            });
            created += 1;
        } else {
            await store.update(existing.id, { title, excerpt, body });
            updated += 1;
        }
    }

    return { created, updated };
}

/** Turns the repository documents passed into the Worker into DocSources. */
export function docSourcesFromRecord(record: Record<string, string>): DocSource[] {
    return Object.entries(record)
        .map(([path, markdown]) => ({
            slug: docSlug(path),
            title: firstHeading(markdown, path.split("/").pop()?.replace(/\.md$/i, "") ?? path),
            markdown
        }))
        .sort((left, right) => left.slug.localeCompare(right.slug));
}

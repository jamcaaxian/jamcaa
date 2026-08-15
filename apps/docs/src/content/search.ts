import type { Database } from "@jamcaaxian/core/db";
import type { EntryOf } from "@jamcaaxian/core/content";
import { d1SearchAdapter, type SearchFilters } from "@jamcaaxian/core/search";
import { post } from "./collections";
import { docsLocales, type DocsLocale } from "./locales";
import { postTable, postTagTable } from "./schema";
import { posts } from "./store";

export interface PostSearchResult {
    entry: EntryOf<typeof post>;
    excerpt: string;
}

export async function searchPosts(
    database: Database,
    request: { query: string; locale?: DocsLocale; filters?: SearchFilters; limit?: number; cursor?: string }
): Promise<{ results: PostSearchResult[]; nextCursor?: string }> {
    const page = await d1SearchAdapter({
        database,
        tableFor: collectionName => (collectionName === post.name ? postTable : undefined),
        tagTableFor: collectionName => (collectionName === post.name ? postTagTable : undefined),
        locales: docsLocales
    }).search({ collection: post, ...request });
    const entries = await posts(database).byIds(page.matches.map(match => match.entryId));
    const entriesById = new Map(entries.map(entry => [entry.id, entry]));

    return {
        results: page.matches.flatMap(match => {
            const entry = entriesById.get(match.entryId);

            return entry === undefined ? [] : [{ entry, excerpt: match.excerpt }];
        }),
        nextCursor: page.nextCursor
    };
}

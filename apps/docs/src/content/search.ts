import type { Database } from "@jamcaa/core/db";
import type { EntryOf } from "@jamcaa/core/content";
import { d1SearchAdapter, type SearchFilters } from "@jamcaa/core/search";
import { post } from "./collections";
import { postTable, postTagTable } from "./schema";
import { posts } from "./store";

export interface PostSearchResult {
    entry: EntryOf<typeof post>;
    excerpt: string;
}

export async function searchPosts(
    database: Database,
    request: { query: string; filters?: SearchFilters; limit?: number; cursor?: string }
): Promise<{ results: PostSearchResult[]; nextCursor?: string }> {
    const page = await d1SearchAdapter({
        database,
        tableFor: collectionName => (collectionName === post.name ? postTable : undefined),
        tagTableFor: collectionName => (collectionName === post.name ? postTagTable : undefined)
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

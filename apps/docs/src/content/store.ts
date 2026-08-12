import {
    entryStore,
    entrySummaryReader,
    formerAddressStore,
    revisionStore,
    tagMembershipStore,
    writeEntryWithTags
} from "@jamcaa/core/content";
import type { EntryStatus, RichTextDocument } from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";
import { post } from "./collections";
import { contentModel, formerPostAddressTable, postRevisionTable, postTable, postTagTable } from "./schema";

export interface PostRevisionSnapshot {
    slug: string;
    status: EntryStatus;
    publishedAt: number | null;
    categoryId: string;
    fields: { title: string; excerpt: string | null; body: RichTextDocument };
    tagIds: string[];
}

export function posts(database: Database) {
    return entryStore({ database, collection: post, table: postTable, tagTable: postTagTable });
}

export function postSummaries(database: Database) {
    return entrySummaryReader({ database, model: contentModel, collection: post });
}

export function formerPostAddresses(database: Database) {
    return formerAddressStore(database, formerPostAddressTable);
}

export function postRevisions(database: Database) {
    return revisionStore<PostRevisionSnapshot>(database, postRevisionTable);
}

export async function postTagIds(database: Database, postId: string): Promise<string[]> {
    return tagMembershipStore(database, postTagTable).listForEntry(postId);
}

export async function replacePostTags(database: Database, postId: string, tagIds: readonly string[]): Promise<void> {
    await tagMembershipStore(database, postTagTable).replaceForEntry(postId, tagIds);
}

export async function writePostWithTags<T>(
    database: Database,
    tagIds: readonly string[],
    preparePost: () => Promise<{ entry: T; statements: readonly D1PreparedStatement[] }>,
    postId: (post: T) => string,
    afterStored?: (post: T, tagIds: readonly string[]) => Promise<readonly D1PreparedStatement[]>
): Promise<T> {
    return writeEntryWithTags({
        database,
        relationTable: postTagTable,
        tagIds,
        prepareEntry: preparePost,
        entryId: postId,
        afterStored
    });
}

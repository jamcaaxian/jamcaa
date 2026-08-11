import {
    entryStore,
    entrySummaryReader,
    formerAddressStore,
    tagMembershipStore,
    writeEntryWithTags
} from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";
import { post } from "./collections";
import { contentModel, formerPostAddressTable, postTable, postTagTable } from "./schema";

export function posts(database: Database) {
    return entryStore({ database, collection: post, table: postTable, tagTable: postTagTable });
}

export function postSummaries(database: Database) {
    return entrySummaryReader({ database, model: contentModel, collection: post });
}

export function formerPostAddresses(database: Database) {
    return formerAddressStore(database, formerPostAddressTable);
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
    writePost: () => Promise<T>,
    postId: (post: T) => string
): Promise<T> {
    return writeEntryWithTags({
        database,
        relationTable: postTagTable,
        tagIds,
        writeEntry: writePost,
        entryId: postId
    });
}

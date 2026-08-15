import {
    entryRevisionStore,
    entryStore,
    entrySummaryReader,
    formerAddressStore,
    tagMembershipStore,
    writeEntryWithTags
} from "@jamcaaxian/core/content";
import type { EntryRevisionSnapshot } from "@jamcaaxian/core/content";
import type { Database } from "@jamcaaxian/core/db";
import { post } from "./collections";
import { docsLocales } from "./locales";
import { contentModel, formerPostAddressTable, postRevisionTable, postTable, postTagTable } from "./schema";

export type PostRevisionSnapshot = EntryRevisionSnapshot<typeof post>;

export function posts(database: Database) {
    return entryStore({ database, collection: post, table: postTable, tagTable: postTagTable, locales: docsLocales });
}

export function postSummaries(database: Database) {
    return entrySummaryReader({ database, model: contentModel, collection: post, locales: docsLocales });
}

export function formerPostAddresses(database: Database) {
    return formerAddressStore(database, formerPostAddressTable, docsLocales);
}

export function postRevisions(database: Database) {
    return entryRevisionStore({ database, collection: post, table: postRevisionTable });
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

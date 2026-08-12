import {
    declaredFieldStorage,
    declaredValues,
    entryRevisionSnapshot,
    toSlug,
    type DeclaredValuesOf,
    type EntryOf,
    type EntryStatus
} from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";
import { compareAndIncrementPublicAddressRevision, comparePublicAddressRevision } from "./public-address-revision";
import { publicPostAddresses } from "./public-addresses";
import { freePublicPostSlug, postAddress } from "./public-paths";
import { postAddressState } from "./settings";
import { formerPostAddresses, postRevisions, posts, writePostWithTags } from "./store";
import { taxonomy } from "./taxonomy";
import { post } from "./collections";

type Post = EntryOf<typeof post>;

export type DesiredPostState = {
    id?: string;
    status: EntryStatus;
    slug: string;
    categoryId: string;
    tagIds: readonly string[];
    publishedAt?: Date | null;
} & DeclaredValuesOf<typeof post>;

export interface CommitPostStateOptions {
    database: Database;
    actorId: string;
    mayPublish: boolean;
    desired: DesiredPostState;
}

export interface RestorePostRevisionOptions {
    database: Database;
    actorId: string;
    mayPublish: boolean;
    entryId: string;
    revisionId: string;
}

async function assertTaxonomyExists(database: Database, categoryId: string, tagIds: readonly string[]) {
    const terms = taxonomy(database);

    if ((await terms.categoryById(categoryId)) === undefined) {
        throw new Error("The selected category no longer exists.");
    }

    for (const tagId of new Set(tagIds)) {
        if ((await terms.tagById(tagId)) === undefined) {
            throw new Error("One of the selected tags no longer exists.");
        }
    }
}

function nextUpdatedAt(current: Post | undefined): Date {
    return new Date(Math.max(Date.now(), (current?.updatedAt.getTime() ?? 0) + 1));
}

function insertPostStatement(database: Database, entry: Post): D1PreparedStatement {
    const fields = declaredFieldStorage(post, entry);

    return database.$client
        .prepare(
            "INSERT INTO post "
                + `(id, slug, status, author_id, category_id, created_at, updated_at, published_at, ${fields.columns}) `
                + `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${fields.placeholders})`
        )
        .bind(
            entry.id,
            entry.slug,
            entry.status,
            entry.authorId,
            entry.categoryId,
            entry.createdAt.getTime(),
            entry.updatedAt.getTime(),
            entry.publishedAt?.getTime() ?? null,
            ...fields.bindings
        );
}

function updatePostStatement(database: Database, before: Post, after: Post): D1PreparedStatement {
    const fields = declaredFieldStorage(post, after);

    return database.$client
        .prepare(
            "UPDATE post SET "
                + "slug = ?, status = ?, "
                + "category_id = CASE WHEN updated_at = ? THEN ? ELSE NULL END, "
                + `updated_at = ?, published_at = ?, ${fields.assignments} `
                + "WHERE id = ?"
        )
        .bind(
            after.slug,
            after.status,
            before.updatedAt.getTime(),
            after.categoryId,
            after.updatedAt.getTime(),
            after.publishedAt?.getTime() ?? null,
            ...fields.bindings,
            after.id
        );
}

export async function commitPostState(options: CommitPostStateOptions): Promise<Post> {
    const { actorId, database, desired, mayPublish } = options;
    const store = posts(database);
    const addresses = publicPostAddresses(database);
    const tagIds = [...new Set(desired.tagIds)].sort();

    await assertTaxonomyExists(database, desired.categoryId, tagIds);

    const current = desired.id === undefined ? undefined : await store.byId(desired.id);

    if (desired.id !== undefined && current === undefined) {
        throw new Error("That post no longer exists.");
    }

    const addressState = await postAddressState(database);
    const pattern = addressState.pattern;
    const publishedAt =
        "publishedAt" in desired ? (desired.publishedAt ?? null)
        : desired.status === "published" ? (current?.publishedAt ?? new Date())
        : desired.status === "draft" ? null
        : (current?.publishedAt ?? null);
    const requestsPublished = desired.status === "published";
    const takesPublishedOffline = current?.status === "published" && desired.status !== "published";
    const changesPublicationTime = publishedAt?.getTime() !== current?.publishedAt?.getTime();

    if (!mayPublish && (requestsPublished || takesPublishedOffline || changesPublicationTime)) {
        throw new Error("You may update this Post, but not change whether it is published.");
    }

    const createdAt = current?.createdAt ?? new Date();
    const wantedSlug = toSlug(
        current === undefined || mayPublish ? desired.slug || desired.title : current.slug || desired.title
    );

    if (!wantedSlug) {
        throw new Error("That title produces no address. Give the post a slug of its own.");
    }

    const expectedAddressRevision = addressState.revision;
    const slug = await freePublicPostSlug({
        wanted: wantedSlug,
        pattern,
        publishedAt,
        createdAt,
        isTaken: async candidate => {
            const taken = await store.bySlug(candidate);
            const formerOwner = await formerPostAddresses(database).entryAt(
                postAddress(pattern, { slug: candidate, publishedAt, createdAt })
            );

            return (
                (taken !== undefined && taken.id !== current?.id)
                || (formerOwner !== undefined && formerOwner !== current?.id)
            );
        }
    });
    const updatedAt = nextUpdatedAt(current);
    const fields = declaredValues(post, desired);
    const stored: Post =
        current === undefined ?
            {
                id: crypto.randomUUID(),
                slug,
                status: desired.status,
                authorId: actorId,
                categoryId: desired.categoryId,
                createdAt,
                updatedAt,
                publishedAt,
                ...fields
            }
        :   {
                ...current,
                slug,
                status: desired.status,
                categoryId: desired.categoryId,
                updatedAt,
                publishedAt,
                ...fields
            };
    const changesAddress =
        current === undefined
        || current.slug !== stored.slug
        || current.status !== stored.status
        || current.publishedAt?.getTime() !== stored.publishedAt?.getTime();

    return writePostWithTags(
        database,
        tagIds,
        async () => {
            await assertTaxonomyExists(database, desired.categoryId, tagIds);

            if (current === undefined) {
                await addresses.assertCurrentAvailable(
                    undefined,
                    postAddress(pattern, { slug, publishedAt, createdAt })
                );

                return {
                    entry: stored,
                    statements: [
                        insertPostStatement(database, stored),
                        ...compareAndIncrementPublicAddressRevision(database, expectedAddressRevision)
                    ]
                };
            }

            return {
                entry: stored,
                statements: [
                    ...(await addresses.entryChangeStatements(current, stored, pattern)),
                    updatePostStatement(database, current, stored),
                    ...(changesAddress ?
                        compareAndIncrementPublicAddressRevision(database, expectedAddressRevision)
                    :   comparePublicAddressRevision(database, expectedAddressRevision))
                ]
            };
        },
        entry => entry.id,
        async (entry, storedTagIds) => [
            postRevisions(database).prepareAppend(entry.id, entryRevisionSnapshot(post, entry, storedTagIds)).statement
        ]
    );
}

export async function restorePostRevision(options: RestorePostRevisionOptions): Promise<Post> {
    const source = await postRevisions(options.database).byId(options.entryId, options.revisionId);

    if (source === undefined) {
        throw new Error("That Revision does not exist for this Post.");
    }

    const current = await posts(options.database).byId(options.entryId);

    if (current === undefined) {
        throw new Error("That Post no longer exists.");
    }

    const sourcePublishedAt = source.snapshot.publishedAt;
    const currentPublishedAt = current.publishedAt?.getTime() ?? null;

    if (
        !options.mayPublish
        && ((current.status === "published" && source.snapshot.status !== current.status)
            || source.snapshot.status === "published"
            || source.snapshot.slug !== current.slug
            || sourcePublishedAt !== currentPublishedAt)
    ) {
        throw new Error("You may update this Post, but not change whether it is published.");
    }

    return commitPostState({
        database: options.database,
        actorId: options.actorId,
        mayPublish: options.mayPublish,
        desired: {
            id: options.entryId,
            ...source.snapshot.fields,
            status: source.snapshot.status,
            slug: source.snapshot.slug,
            categoryId: source.snapshot.categoryId,
            tagIds: source.snapshot.tagIds,
            publishedAt: source.snapshot.publishedAt === null ? null : new Date(source.snapshot.publishedAt)
        }
    });
}

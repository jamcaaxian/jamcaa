import { and, desc, eq, lt } from "drizzle-orm";
import type { Database } from "../db/client";
import { bucket, media, storageRule } from "../db/schema/media";
import { createStorageAdapter, type SigningCredentials, type StorageAdapter } from "./adapter";
import { objectKeyFor } from "./keys";
import { chooseRule, parseConditions, type StorageRule, type UploadContext } from "./rules";

export interface StoredMedia {
    id: string;
    bucketId: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    size: number;
    alt: string | null;
    state: "pending" | "stored";
    uploaderId: string;
    createdAt: Date;
}

export interface UploadTarget {
    rule: StorageRule;
    bucketId: string;
}

async function loadRules(database: Database): Promise<StorageRule[]> {
    const rows = await database.select().from(storageRule);

    return rows.flatMap(row => {
        const conditions = parseConditions(row.conditions);

        // A rule nobody can read is left out rather than treated as one with no
        // conditions, which would make it claim every file.
        return conditions === undefined ? [] : [{ ...row, conditions }];
    });
}

export async function chooseUploadTarget(database: Database, context: UploadContext): Promise<UploadTarget> {
    const rule = chooseRule(await loadRules(database), context);

    return { rule, bucketId: rule.bucketId };
}

export interface UploadRequest {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    file: { name: string; type: string; size: number; body: ArrayBuffer };
    context: UploadContext;
    uploaderId: string;
}

/**
 * Writes the file, then records it. The record is made first and left pending until
 * the write returns, so a file that reached the bucket while the answer was lost is
 * still accounted for; see docs/adr/0006.
 */
export async function acceptUpload(request: UploadRequest): Promise<StoredMedia> {
    const { database, bindings, credentials, file, context, uploaderId } = request;

    const target = await chooseUploadTarget(database, context);
    const [record] = await database.select().from(bucket).where(eq(bucket.id, target.bucketId)).limit(1);

    if (record === undefined) {
        throw new Error(`Rule "${target.rule.label}" points at bucket "${target.bucketId}", which is not configured.`);
    }

    const id = crypto.randomUUID();
    const objectKey = objectKeyFor({ id, filename: file.name, at: context.at });

    await database
        .insert(media)
        .values({
            id,
            bucketId: record.id,
            objectKey,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            state: "pending",
            uploaderId
        });

    try {
        const adapter = createStorageAdapter({ record, bindings, credentials });

        await adapter.put(objectKey, file.body, file.type);
    } catch (error) {
        // Nothing reached the bucket, so the record would only ever be litter.
        await database.delete(media).where(eq(media.id, id));

        throw error;
    }

    await database.update(media).set({ state: "stored" }).where(eq(media.id, id));

    const stored = await mediaById(database, id);

    if (stored === undefined) {
        throw new Error("The file was stored but its record could not be read back.");
    }

    return stored;
}

export async function mediaById(database: Database, id: string): Promise<StoredMedia | undefined> {
    const [row] = await database.select().from(media).where(eq(media.id, id)).limit(1);

    return row;
}

/**
 * The record together with a way to reach the bucket it lives in. Which bucket that
 * is belongs to the media layer, so callers never have to name one.
 */
export async function openMedia(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    id: string;
}): Promise<{ record: StoredMedia; adapter: StorageAdapter } | undefined> {
    const { database, bindings, credentials, id } = options;
    const record = await mediaById(database, id);

    if (record === undefined) {
        return undefined;
    }

    const [where] = await database.select().from(bucket).where(eq(bucket.id, record.bucketId)).limit(1);

    return where === undefined ? undefined : (
            { record, adapter: createStorageAdapter({ record: where, bindings, credentials }) }
        );
}

export async function listMedia(
    database: Database,
    query: { limit?: number; offset?: number } = {}
): Promise<StoredMedia[]> {
    return database
        .select()
        .from(media)
        .where(eq(media.state, "stored"))
        .orderBy(desc(media.createdAt))
        .limit(query.limit ?? 60)
        .offset(query.offset ?? 0);
}

export async function removeMedia(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    id: string;
}): Promise<void> {
    const { database, bindings, credentials, id } = options;
    const record = await mediaById(database, id);

    if (record === undefined) {
        return;
    }

    const [where] = await database.select().from(bucket).where(eq(bucket.id, record.bucketId)).limit(1);

    if (where !== undefined) {
        const adapter = createStorageAdapter({ record: where, bindings, credentials });

        await adapter.remove(record.objectKey);
    }

    await database.delete(media).where(eq(media.id, id));
}

/**
 * An upload whose answer never arrived leaves a pending record and, sometimes, an
 * object nobody claims. Sweeping them is the reclamation path ADR-0006 requires.
 */
export async function reclaimAbandonedUploads(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    olderThan: Date;
}): Promise<number> {
    const { database, bindings, credentials, olderThan } = options;

    const abandoned = await database
        .select()
        .from(media)
        .where(and(eq(media.state, "pending"), lt(media.createdAt, olderThan)));

    for (const record of abandoned) {
        await removeMedia({ database, bindings, credentials, id: record.id });
    }

    return abandoned.length;
}

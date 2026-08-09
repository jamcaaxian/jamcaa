import { and, desc, eq, lt } from "drizzle-orm";
import type { Database } from "../db/client";
import { bucket, media, multipartUpload, storageRule } from "../db/schema/media";
import { createStorageAdapter, type SigningCredentials, type StorageAdapter, type UploadedPart } from "./adapter";
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

export interface PendingUpload {
    id: string;
    bucketId: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    size: number;
    putUrl: string;
    expiresInSeconds: number;
}

export interface MultipartPart {
    partNumber: number;
    offset: number;
    size: number;
    putUrl: string;
}

export interface MultipartUploadPlan {
    id: string;
    bucketId: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadId: string;
    partSize: number;
    completedParts: UploadedPart[];
    parts: MultipartPart[];
    expiresInSeconds: number;
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

export interface BeginUploadRequest {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    file: { name: string; type: string; size: number };
    context: UploadContext;
    uploaderId: string;
    expiresInSeconds: number;
}

export interface PlanMultipartUploadRequest extends BeginUploadRequest {
    fingerprint: string;
    partSize: number;
    partAddressFor?: (input: { objectKey: string; uploadId: string; partNumber: number }) => Promise<string> | string;
}

function validExpiry(expiresInSeconds: number) {
    return Number.isSafeInteger(expiresInSeconds) && expiresInSeconds >= 1 && expiresInSeconds <= 604_800;
}

function validPartSize(partSize: number) {
    return Number.isSafeInteger(partSize) && partSize >= 5 * 1024 * 1024 && partSize <= 5 * 1024 * 1024 * 1024;
}

function completedPartsFrom(value: string): UploadedPart[] {
    try {
        const parsed = JSON.parse(value) as unknown;

        return Array.isArray(parsed) ?
                parsed.flatMap(part => {
                    if (
                        typeof part === "object"
                        && part !== null
                        && Number.isSafeInteger((part as UploadedPart).partNumber)
                        && (part as UploadedPart).partNumber > 0
                        && typeof (part as UploadedPart).etag === "string"
                    ) {
                        return [part as UploadedPart];
                    }

                    return [];
                })
            :   [];
    } catch {
        return [];
    }
}

async function uploadDestination(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    context: UploadContext;
}) {
    const { database, bindings, credentials, context } = options;
    const target = await chooseUploadTarget(database, context);
    const [record] = await database.select().from(bucket).where(eq(bucket.id, target.bucketId)).limit(1);

    if (record === undefined) {
        throw new Error(`Rule "${target.rule.label}" points at bucket "${target.bucketId}", which is not configured.`);
    }

    return { record, adapter: createStorageAdapter({ record, bindings, credentials }) };
}

async function createPendingMedia(options: {
    database: Database;
    bucketId: string;
    file: { name: string; type: string; size: number };
    at: Date;
    uploaderId: string;
}) {
    const { database, bucketId, file, at, uploaderId } = options;
    const id = crypto.randomUUID();
    const objectKey = objectKeyFor({ id, filename: file.name, at });

    await database
        .insert(media)
        .values({
            id,
            bucketId,
            objectKey,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            state: "pending",
            uploaderId
        });

    return { id, objectKey };
}

export async function beginUpload(request: BeginUploadRequest): Promise<PendingUpload> {
    const { database, bindings, credentials, file, context, uploaderId, expiresInSeconds } = request;

    if (!validExpiry(expiresInSeconds)) {
        throw new Error("A direct upload address must expire between 1 second and 7 days.");
    }

    const { record, adapter } = await uploadDestination({ database, bindings, credentials, context });

    if (adapter.presignPut === undefined) {
        throw new Error(`Bucket "${record.id}" cannot accept a direct upload.`);
    }

    const pending = await createPendingMedia({ database, bucketId: record.id, file, at: context.at, uploaderId });

    try {
        const putUrl = await adapter.presignPut(pending.objectKey, file.type, expiresInSeconds);

        return {
            ...pending,
            bucketId: record.id,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            putUrl,
            expiresInSeconds
        };
    } catch (error) {
        await database.delete(media).where(eq(media.id, pending.id));
        throw error;
    }
}

async function multipartPlan(options: {
    adapter: StorageAdapter;
    record: StoredMedia;
    upload: typeof multipartUpload.$inferSelect;
    expiresInSeconds: number;
    partAddressFor?: PlanMultipartUploadRequest["partAddressFor"];
}) {
    const { adapter, record, upload, expiresInSeconds, partAddressFor } = options;

    if (
        adapter.multipart === undefined
        || (adapter.multipart.presignPart === undefined && partAddressFor === undefined)
    ) {
        throw new Error(`Bucket "${record.bucketId}" cannot accept a multipart upload.`);
    }
    const presignPart =
        partAddressFor
        ?? ((input: { objectKey: string; uploadId: string; partNumber: number }) =>
            adapter.multipart!.presignPart!(input.objectKey, input.uploadId, input.partNumber, expiresInSeconds));

    const completedParts = completedPartsFrom(upload.completedParts).sort(
        (left, right) => left.partNumber - right.partNumber
    );
    const completed = new Set(completedParts.map(part => part.partNumber));
    const partCount = Math.ceil(record.size / upload.partSize);
    const parts = await Promise.all(
        Array.from({ length: partCount }, async (_, index) => {
            const partNumber = index + 1;

            if (completed.has(partNumber)) {
                return undefined;
            }

            const offset = index * upload.partSize;

            return {
                partNumber,
                offset,
                size: Math.min(upload.partSize, record.size - offset),
                putUrl: await presignPart({ objectKey: record.objectKey, uploadId: upload.uploadId, partNumber })
            };
        })
    );

    return {
        id: record.id,
        bucketId: record.bucketId,
        objectKey: record.objectKey,
        filename: record.filename,
        mimeType: record.mimeType,
        size: record.size,
        uploadId: upload.uploadId,
        partSize: upload.partSize,
        completedParts,
        parts: parts.filter((part): part is MultipartPart => part !== undefined),
        expiresInSeconds
    };
}

export async function planMultipartUpload(request: PlanMultipartUploadRequest): Promise<MultipartUploadPlan> {
    const {
        database,
        bindings,
        credentials,
        file,
        context,
        uploaderId,
        expiresInSeconds,
        fingerprint,
        partSize,
        partAddressFor
    } = request;
    const scopedFingerprint = JSON.stringify([uploaderId, fingerprint]);

    if (!validExpiry(expiresInSeconds)) {
        throw new Error("A multipart upload address must expire between 1 second and 7 days.");
    }

    if (!validPartSize(partSize)) {
        throw new Error("A multipart upload part must be between 5 MiB and 5 GiB.");
    }

    const [existing] = await database
        .select({ record: media, upload: multipartUpload })
        .from(multipartUpload)
        .innerJoin(media, eq(media.id, multipartUpload.mediaId))
        .where(eq(multipartUpload.fingerprint, scopedFingerprint))
        .limit(1);

    if (existing !== undefined) {
        if (existing.record.uploaderId !== uploaderId) {
            throw new Error("That multipart upload does not belong to this uploader.");
        }

        if (
            existing.record.filename !== file.name
            || existing.record.mimeType !== file.type
            || existing.record.size !== file.size
        ) {
            throw new Error("That file fingerprint belongs to a different upload.");
        }

        const [where] = await database.select().from(bucket).where(eq(bucket.id, existing.record.bucketId)).limit(1);

        if (where === undefined) {
            throw new Error(`Bucket "${existing.record.bucketId}" is no longer configured.`);
        }

        return multipartPlan({
            adapter: createStorageAdapter({ record: where, bindings, credentials }),
            record: existing.record,
            upload: existing.upload,
            expiresInSeconds,
            partAddressFor
        });
    }

    const { record: destination, adapter } = await uploadDestination({ database, bindings, credentials, context });

    if (adapter.multipart === undefined) {
        throw new Error(`Bucket "${destination.id}" cannot accept a multipart upload.`);
    }

    const pending = await createPendingMedia({ database, bucketId: destination.id, file, at: context.at, uploaderId });

    try {
        const uploadId = await adapter.multipart.begin(pending.objectKey, file.type);
        try {
            await database
                .insert(multipartUpload)
                .values({
                    mediaId: pending.id,
                    uploadId,
                    fingerprint: scopedFingerprint,
                    partSize,
                    completedParts: "[]"
                });
        } catch (error) {
            await adapter.multipart.abort(pending.objectKey, uploadId).catch(() => undefined);
            throw error;
        }
        const record = await mediaById(database, pending.id);
        const [upload] = await database
            .select()
            .from(multipartUpload)
            .where(eq(multipartUpload.mediaId, pending.id))
            .limit(1);

        if (record === undefined || upload === undefined) {
            throw new Error("The multipart upload was created but could not be read back.");
        }

        return multipartPlan({ adapter, record, upload, expiresInSeconds, partAddressFor });
    } catch (error) {
        await database.delete(media).where(eq(media.id, pending.id));
        throw error;
    }
}

export async function recordMultipartPart(options: {
    database: Database;
    id: string;
    uploaderId: string;
    part: UploadedPart;
}): Promise<void> {
    const { database, id, uploaderId, part } = options;
    const record = await mediaById(database, id);
    const [upload] = await database.select().from(multipartUpload).where(eq(multipartUpload.mediaId, id)).limit(1);

    if (record === undefined || upload === undefined) {
        throw new Error("That multipart upload no longer exists.");
    }

    if (record.uploaderId !== uploaderId) {
        throw new Error("That multipart upload does not belong to this uploader.");
    }

    if (!Number.isSafeInteger(part.partNumber) || part.partNumber < 1 || !part.etag) {
        throw new Error("That multipart upload part is invalid.");
    }

    const parts = completedPartsFrom(upload.completedParts).filter(saved => saved.partNumber !== part.partNumber);
    parts.push(part);
    parts.sort((left, right) => left.partNumber - right.partNumber);

    await database
        .update(multipartUpload)
        .set({ completedParts: JSON.stringify(parts), updatedAt: new Date() })
        .where(eq(multipartUpload.mediaId, id));
}

export async function completeMultipartUpload(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    id: string;
    uploaderId: string;
}): Promise<StoredMedia> {
    const { database, bindings, credentials, id, uploaderId } = options;
    const record = await mediaById(database, id);
    const [upload] = await database.select().from(multipartUpload).where(eq(multipartUpload.mediaId, id)).limit(1);

    if (record === undefined) {
        throw new Error("That multipart upload no longer exists.");
    }

    if (record.uploaderId !== uploaderId) {
        throw new Error("That multipart upload does not belong to this uploader.");
    }

    if (upload === undefined) {
        if (record.state === "stored") {
            return record;
        }

        throw new Error("That multipart upload no longer exists.");
    }

    const [where] = await database.select().from(bucket).where(eq(bucket.id, record.bucketId)).limit(1);

    if (where === undefined) {
        throw new Error(`Bucket "${record.bucketId}" is no longer configured.`);
    }

    const adapter = createStorageAdapter({ record: where, bindings, credentials });

    if (adapter.multipart === undefined) {
        throw new Error(`Bucket "${record.bucketId}" cannot complete a multipart upload.`);
    }

    const parts = completedPartsFrom(upload.completedParts).sort((left, right) => left.partNumber - right.partNumber);
    const expected = Math.ceil(record.size / upload.partSize);

    if (parts.length !== expected || parts.some((part, index) => part.partNumber !== index + 1)) {
        throw new Error("The multipart upload still has unfinished parts.");
    }

    await adapter.multipart.complete(record.objectKey, upload.uploadId, parts);
    const stored = await confirmUpload({ database, bindings, credentials, id, uploaderId });
    await database.delete(multipartUpload).where(eq(multipartUpload.mediaId, id));

    return stored;
}

export async function confirmUpload(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    id: string;
    uploaderId: string;
}): Promise<StoredMedia> {
    const { database, bindings, credentials, id, uploaderId } = options;
    const record = await mediaById(database, id);

    if (record === undefined) {
        throw new Error("That pending upload no longer exists.");
    }

    if (record.uploaderId !== uploaderId) {
        throw new Error("That pending upload does not belong to this uploader.");
    }

    if (record.state === "stored") {
        return record;
    }

    const [where] = await database.select().from(bucket).where(eq(bucket.id, record.bucketId)).limit(1);

    if (where === undefined) {
        throw new Error(`Bucket "${record.bucketId}" is no longer configured.`);
    }

    const adapter = createStorageAdapter({ record: where, bindings, credentials });
    const object = await adapter.head(record.objectKey);

    if (object === undefined) {
        throw new Error("The direct upload has not reached its bucket yet.");
    }

    if (object.size !== record.size || object.mimeType !== record.mimeType) {
        throw new Error("The stored object does not match the file that was prepared.");
    }

    await database.update(media).set({ state: "stored" }).where(eq(media.id, id));

    const stored = await mediaById(database, id);

    if (stored === undefined) {
        throw new Error("The file was confirmed but its record could not be read back.");
    }

    return stored;
}

export async function cancelUpload(options: {
    database: Database;
    bindings: Record<string, unknown>;
    credentials?: SigningCredentials;
    id: string;
    uploaderId: string;
}): Promise<void> {
    const { database, bindings, credentials, id, uploaderId } = options;
    const record = await mediaById(database, id);

    if (record === undefined) {
        return;
    }

    if (record.uploaderId !== uploaderId) {
        throw new Error("That pending upload does not belong to this uploader.");
    }

    if (record.state !== "pending") {
        throw new Error("A stored file cannot be cancelled as a pending upload.");
    }

    await removeMedia({ database, bindings, credentials, id });
}

/**
 * Writes the file, then records it. The record is made first and left pending until
 * the write returns, so a file that reached the bucket while the answer was lost is
 * still accounted for; see docs/adr/0006.
 */
export async function acceptUpload(request: UploadRequest): Promise<StoredMedia> {
    const { database, bindings, credentials, file, context, uploaderId } = request;

    const { record, adapter } = await uploadDestination({ database, bindings, credentials, context });
    const pending = await createPendingMedia({ database, bucketId: record.id, file, at: context.at, uploaderId });

    try {
        await adapter.put(pending.objectKey, file.body, file.type);
    } catch (error) {
        // Nothing reached the bucket, so the record would only ever be litter.
        await database.delete(media).where(eq(media.id, pending.id));

        throw error;
    }

    await database.update(media).set({ state: "stored" }).where(eq(media.id, pending.id));

    const stored = await mediaById(database, pending.id);

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

    const [upload] = await database.select().from(multipartUpload).where(eq(multipartUpload.mediaId, id)).limit(1);
    const [where] = await database.select().from(bucket).where(eq(bucket.id, record.bucketId)).limit(1);

    if (where !== undefined) {
        const adapter = createStorageAdapter({ record: where, bindings, credentials });

        if (upload !== undefined) {
            if (adapter.multipart === undefined) {
                throw new Error(`Bucket "${record.bucketId}" cannot abort its multipart upload.`);
            }

            await adapter.multipart.abort(record.objectKey, upload.uploadId);
        }

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

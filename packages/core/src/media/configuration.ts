import { asc, count, eq, inArray, max, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { bucket, media, storageRule } from "../db/schema/media";
import { parseConditions, type StorageConditions } from "./rules";

export type StorageConfigurationErrorCode =
    | "bucket-exists"
    | "bucket-in-use"
    | "bucket-not-found"
    | "binding-unavailable"
    | "fallback-rule-protected"
    | "invalid-bucket"
    | "invalid-conditions"
    | "invalid-order"
    | "invalid-rule"
    | "rule-not-found";

export class StorageConfigurationError extends Error {
    constructor(
        public readonly code: StorageConfigurationErrorCode,
        message: string
    ) {
        super(message);
        this.name = "StorageConfigurationError";
    }
}

export interface ManagedBucket {
    id: string;
    label: string;
    kind: "binding" | "s3";
    binding: string | null;
    endpoint: string | null;
    region: string | null;
    bucketName: string | null;
    publicUrl: string | null;
    mediaCount: number;
    ruleCount: number;
    isFallbackTarget: boolean;
    reachable: boolean;
    mayDelete: boolean;
    deleteBlocker?: string;
}

export interface ManagedStorageRule {
    id: string;
    label: string;
    bucketId: string;
    priority: number;
    isFallback: boolean;
    /** Undefined means the stored JSON is damaged and this rule is not used for uploads. */
    conditions: StorageConditions | undefined;
}

export interface StorageConfigurationSnapshot {
    buckets: ManagedBucket[];
    rules: ManagedStorageRule[];
}

export interface NewBindingBucket {
    id: string;
    label: string;
    binding: string;
    bucketName?: string;
    publicUrl?: string;
}

export interface RuleInput {
    label: string;
    bucketId: string;
    conditions: StorageConditions;
}

export type StorageConfigurationChange =
    | { type: "create-binding-bucket"; bucket: NewBindingBucket }
    | { type: "update-bucket"; id: string; label: string; publicUrl?: string }
    | { type: "delete-bucket"; id: string }
    | { type: "create-rule"; rule: RuleInput }
    | { type: "update-rule"; id: string; rule: RuleInput }
    | { type: "delete-rule"; id: string }
    | { type: "update-fallback"; bucketId: string }
    | { type: "reorder-rules"; orderedIds: readonly string[] };

export interface StorageConfiguration {
    inspect(): Promise<StorageConfigurationSnapshot>;
    apply(change: StorageConfigurationChange): Promise<void>;
}

const BUCKET_ID = /^[a-z][a-z0-9-]{0,62}$/;
const BINDING_NAME = /^[A-Z_][A-Z0-9_]*$/;
const MAX_LABEL_LENGTH = 120;

function requiredLabel(value: string, subject: "bucket" | "rule") {
    const label = value.trim();

    if (!label || label.length > MAX_LABEL_LENGTH) {
        throw new StorageConfigurationError(
            subject === "bucket" ? "invalid-bucket" : "invalid-rule",
            `A ${subject} name must be between 1 and ${MAX_LABEL_LENGTH} characters.`
        );
    }

    return label;
}

function publicUrlOf(value: string | undefined): string | null {
    const raw = value?.trim();

    if (!raw) {
        return null;
    }

    let parsed: URL;

    try {
        parsed = new URL(raw);
    } catch {
        throw new StorageConfigurationError("invalid-bucket", "The public address must be an absolute URL.");
    }

    if (
        !["http:", "https:"].includes(parsed.protocol)
        || parsed.username
        || parsed.password
        || parsed.search
        || parsed.hash
    ) {
        throw new StorageConfigurationError(
            "invalid-bucket",
            "The public address must use HTTP or HTTPS and cannot contain credentials, a query, or a fragment."
        );
    }

    return parsed.toString().replace(/\/$/, "");
}

function uniqueValues(values: readonly string[] | undefined, transform = (value: string) => value) {
    if (values === undefined) {
        return undefined;
    }

    const normalised = [...new Set(values.map(value => transform(value.trim())).filter(Boolean))];

    return normalised.length > 0 ? normalised : undefined;
}

function nonNegativeInteger(value: number | undefined, label: string) {
    if (value === undefined) {
        return undefined;
    }

    if (!Number.isSafeInteger(value) || value < 0) {
        throw new StorageConfigurationError("invalid-conditions", `${label} must be a non-negative whole number.`);
    }

    return value;
}

function moment(value: string | undefined, edge: "from" | "until") {
    const raw = value?.trim();

    if (!raw) {
        return undefined;
    }

    const expanded =
        /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${edge === "from" ? "00:00:00.000" : "23:59:59.999"}Z` : raw;
    const parsed = new Date(expanded);

    if (Number.isNaN(parsed.getTime())) {
        throw new StorageConfigurationError(
            "invalid-conditions",
            `${edge === "from" ? "From" : "Until"} is not a date.`
        );
    }

    return parsed.toISOString();
}

function normaliseConditions(input: StorageConditions): StorageConditions {
    const minSize = nonNegativeInteger(input.minSize, "Minimum size");
    const maxSize = nonNegativeInteger(input.maxSize, "Maximum size");
    const from = moment(input.from, "from");
    const until = moment(input.until, "until");

    if (minSize !== undefined && maxSize !== undefined && minSize > maxSize) {
        throw new StorageConfigurationError("invalid-conditions", "Minimum size cannot be greater than maximum size.");
    }

    if (from !== undefined && until !== undefined && new Date(from) > new Date(until)) {
        throw new StorageConfigurationError("invalid-conditions", "The start date cannot be after the end date.");
    }

    const mimePrefixes = uniqueValues(input.mimePrefixes, value => value.toLowerCase());

    if (mimePrefixes?.some(prefix => !prefix.includes("/"))) {
        throw new StorageConfigurationError(
            "invalid-conditions",
            "Each MIME type or prefix must contain a slash, such as image/ or application/pdf."
        );
    }

    return {
        ...(uniqueValues(input.collections) ? { collections: uniqueValues(input.collections) } : {}),
        ...(uniqueValues(input.categories) ? { categories: uniqueValues(input.categories) } : {}),
        ...(uniqueValues(input.tags) ? { tags: uniqueValues(input.tags) } : {}),
        ...(uniqueValues(input.authorRoles) ? { authorRoles: uniqueValues(input.authorRoles) } : {}),
        ...(uniqueValues(input.authorIds) ? { authorIds: uniqueValues(input.authorIds) } : {}),
        ...(mimePrefixes ? { mimePrefixes } : {}),
        ...(minSize !== undefined ? { minSize } : {}),
        ...(maxSize !== undefined ? { maxSize } : {}),
        ...(from ? { from } : {}),
        ...(until ? { until } : {})
    };
}

function isR2Bucket(value: unknown): value is R2Bucket {
    return (
        typeof value === "object"
        && value !== null
        && typeof (value as R2Bucket).put === "function"
        && typeof (value as R2Bucket).get === "function"
        && typeof (value as R2Bucket).delete === "function"
    );
}

function reachable(record: typeof bucket.$inferSelect, bindings: Record<string, unknown>) {
    if (record.kind === "binding") {
        return record.binding !== null && isR2Bucket(bindings[record.binding]);
    }

    return Boolean(record.endpoint && record.bucketName && record.accessKeyId && record.secretAccessKey);
}

async function existingBucket(database: Database, id: string) {
    const [record] = await database.select().from(bucket).where(eq(bucket.id, id)).limit(1);

    if (record === undefined) {
        throw new StorageConfigurationError("bucket-not-found", "That bucket no longer exists.");
    }

    return record;
}

async function existingRule(database: Database, id: string) {
    const [record] = await database.select().from(storageRule).where(eq(storageRule.id, id)).limit(1);

    if (record === undefined) {
        throw new StorageConfigurationError("rule-not-found", "That storage rule no longer exists.");
    }

    return record;
}

async function assertRuleTarget(database: Database, bucketId: string) {
    await existingBucket(database, bucketId);
}

export function createStorageConfiguration(options: {
    database: Database;
    bindings?: Record<string, unknown>;
}): StorageConfiguration {
    const { database, bindings = {} } = options;

    return {
        async inspect() {
            const [bucketRows, ruleRows, mediaCounts, ruleCounts] = await Promise.all([
                database.select().from(bucket).orderBy(asc(bucket.createdAt)),
                database.select().from(storageRule).orderBy(asc(storageRule.priority), asc(storageRule.createdAt)),
                database.select({ bucketId: media.bucketId, total: count() }).from(media).groupBy(media.bucketId),
                database
                    .select({ bucketId: storageRule.bucketId, total: count() })
                    .from(storageRule)
                    .groupBy(storageRule.bucketId)
            ]);

            const mediaByBucket = new Map(mediaCounts.map(row => [row.bucketId, row.total]));
            const rulesByBucket = new Map(ruleCounts.map(row => [row.bucketId, row.total]));
            const fallback = ruleRows.find(rule => rule.isFallback);

            const buckets = bucketRows.map(record => {
                const mediaCount = mediaByBucket.get(record.id) ?? 0;
                const ruleCount = rulesByBucket.get(record.id) ?? 0;
                const deleteBlocker =
                    ruleCount > 0 ? "Move or delete every rule that uses this bucket first."
                    : mediaCount > 0 ? "This bucket still holds media."
                    : undefined;

                return {
                    id: record.id,
                    label: record.label,
                    kind: record.kind,
                    binding: record.binding,
                    endpoint: record.endpoint,
                    region: record.region,
                    bucketName: record.bucketName,
                    publicUrl: record.publicUrl,
                    mediaCount,
                    ruleCount,
                    isFallbackTarget: fallback?.bucketId === record.id,
                    reachable: reachable(record, bindings),
                    mayDelete: deleteBlocker === undefined,
                    ...(deleteBlocker ? { deleteBlocker } : {})
                };
            });

            const rules = ruleRows
                .map(record => ({
                    id: record.id,
                    label: record.label,
                    bucketId: record.bucketId,
                    priority: record.priority,
                    isFallback: record.isFallback,
                    conditions: parseConditions(record.conditions)
                }))
                .sort(
                    (left, right) =>
                        Number(left.isFallback) - Number(right.isFallback) || left.priority - right.priority
                );

            return { buckets, rules };
        },

        async apply(change) {
            switch (change.type) {
                case "create-binding-bucket": {
                    const id = change.bucket.id.trim();
                    const binding = change.bucket.binding.trim();
                    const bucketName = change.bucket.bucketName?.trim() || null;

                    if (!BUCKET_ID.test(id)) {
                        throw new StorageConfigurationError(
                            "invalid-bucket",
                            "The bucket ID must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens."
                        );
                    }

                    if (!BINDING_NAME.test(binding)) {
                        throw new StorageConfigurationError(
                            "invalid-bucket",
                            "The binding must use uppercase letters, numbers, and underscores."
                        );
                    }

                    if (!isR2Bucket(bindings[binding])) {
                        throw new StorageConfigurationError(
                            "binding-unavailable",
                            `This deployment does not have an R2 binding named "${binding}".`
                        );
                    }

                    const [duplicate] = await database
                        .select({ id: bucket.id })
                        .from(bucket)
                        .where(eq(bucket.id, id))
                        .limit(1);

                    if (duplicate !== undefined) {
                        throw new StorageConfigurationError(
                            "bucket-exists",
                            `A bucket with the ID "${id}" already exists.`
                        );
                    }

                    await database
                        .insert(bucket)
                        .values({
                            id,
                            label: requiredLabel(change.bucket.label, "bucket"),
                            kind: "binding",
                            binding,
                            bucketName,
                            publicUrl: publicUrlOf(change.bucket.publicUrl)
                        });
                    return;
                }

                case "update-bucket": {
                    await existingBucket(database, change.id);
                    await database
                        .update(bucket)
                        .set({ label: requiredLabel(change.label, "bucket"), publicUrl: publicUrlOf(change.publicUrl) })
                        .where(eq(bucket.id, change.id));
                    return;
                }

                case "delete-bucket": {
                    await existingBucket(database, change.id);
                    const [ruleUse, mediaUse] = await Promise.all([
                        database
                            .select({ total: count() })
                            .from(storageRule)
                            .where(eq(storageRule.bucketId, change.id))
                            .limit(1),
                        database.select({ total: count() }).from(media).where(eq(media.bucketId, change.id)).limit(1)
                    ]);

                    if ((ruleUse[0]?.total ?? 0) > 0 || (mediaUse[0]?.total ?? 0) > 0) {
                        throw new StorageConfigurationError(
                            "bucket-in-use",
                            "Move its rules and media before deleting this bucket."
                        );
                    }

                    await database.delete(bucket).where(eq(bucket.id, change.id));
                    return;
                }

                case "create-rule": {
                    await assertRuleTarget(database, change.rule.bucketId);
                    const [highestPriority] = await database
                        .select({ highest: max(storageRule.priority) })
                        .from(storageRule)
                        .where(eq(storageRule.isFallback, false));

                    await database
                        .insert(storageRule)
                        .values({
                            id: crypto.randomUUID(),
                            label: requiredLabel(change.rule.label, "rule"),
                            bucketId: change.rule.bucketId,
                            priority: (highestPriority?.highest ?? 0) + 10,
                            isFallback: false,
                            conditions: JSON.stringify(normaliseConditions(change.rule.conditions))
                        });
                    return;
                }

                case "update-rule": {
                    const record = await existingRule(database, change.id);

                    if (record.isFallback) {
                        throw new StorageConfigurationError(
                            "fallback-rule-protected",
                            "The fallback rule can only change its destination bucket."
                        );
                    }

                    await assertRuleTarget(database, change.rule.bucketId);
                    await database
                        .update(storageRule)
                        .set({
                            label: requiredLabel(change.rule.label, "rule"),
                            bucketId: change.rule.bucketId,
                            conditions: JSON.stringify(normaliseConditions(change.rule.conditions))
                        })
                        .where(eq(storageRule.id, change.id));
                    return;
                }

                case "delete-rule": {
                    const record = await existingRule(database, change.id);

                    if (record.isFallback) {
                        throw new StorageConfigurationError(
                            "fallback-rule-protected",
                            "The fallback rule keeps uploads safe and cannot be deleted."
                        );
                    }

                    await database.delete(storageRule).where(eq(storageRule.id, change.id));
                    return;
                }

                case "update-fallback": {
                    await assertRuleTarget(database, change.bucketId);
                    const [fallback] = await database
                        .select({ id: storageRule.id })
                        .from(storageRule)
                        .where(eq(storageRule.isFallback, true))
                        .limit(1);

                    if (fallback === undefined) {
                        throw new StorageConfigurationError("rule-not-found", "The fallback rule is missing.");
                    }

                    await database
                        .update(storageRule)
                        .set({ bucketId: change.bucketId, conditions: "{}" })
                        .where(eq(storageRule.id, fallback.id));
                    return;
                }

                case "reorder-rules": {
                    const current = await database
                        .select({ id: storageRule.id })
                        .from(storageRule)
                        .where(eq(storageRule.isFallback, false))
                        .orderBy(asc(storageRule.priority), asc(storageRule.createdAt));
                    const expected = current.map(rule => rule.id);
                    const submitted = [...change.orderedIds];

                    if (
                        submitted.length !== expected.length
                        || new Set(submitted).size !== submitted.length
                        || submitted.some(id => !expected.includes(id))
                    ) {
                        throw new StorageConfigurationError(
                            "invalid-order",
                            "The rule order changed elsewhere. Reload the page and try again."
                        );
                    }

                    if (submitted.length > 0) {
                        const priorities = submitted.map(
                            (id, index) => sql`when ${storageRule.id} = ${id} then ${(index + 1) * 10}`
                        );

                        await database
                            .update(storageRule)
                            .set({ priority: sql`case ${sql.join(priorities, sql.raw(" "))} end` })
                            .where(inArray(storageRule.id, submitted));
                    }
                    return;
                }
            }
        }
    };
}

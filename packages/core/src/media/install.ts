import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { bucket, storageRule } from "../db/schema/media";

export interface BucketSeed {
    id: string;
    label: string;
    kind: "binding" | "s3";
    binding?: string;
    endpoint?: string;
    region?: string;
    bucketName?: string;
    publicUrl?: string;
}

/**
 * A site cannot accept a single upload until there is somewhere to put it and a rule
 * saying so, so both are written at installation rather than left to be discovered
 * missing later. Existing rows are left alone: this runs on an installed site too.
 */
export async function seedStorage(
    database: Database,
    options: { buckets: readonly BucketSeed[]; fallbackBucketId: string }
): Promise<void> {
    const { buckets, fallbackBucketId } = options;

    if (!buckets.some(candidate => candidate.id === fallbackBucketId)) {
        throw new Error(`The fallback bucket "${fallbackBucketId}" is not among the buckets given.`);
    }

    for (const seed of buckets) {
        await database
            .insert(bucket)
            .values({
                id: seed.id,
                label: seed.label,
                kind: seed.kind,
                binding: seed.binding ?? null,
                endpoint: seed.endpoint ?? null,
                region: seed.region ?? null,
                bucketName: seed.bucketName ?? null,
                publicUrl: seed.publicUrl ?? null
            })
            .onConflictDoNothing();
    }

    const [existing] = await database
        .select({ id: storageRule.id })
        .from(storageRule)
        .where(eq(storageRule.isFallback, true))
        .limit(1);

    if (existing !== undefined) {
        return;
    }

    await database
        .insert(storageRule)
        .values({
            id: crypto.randomUUID(),
            label: "Everything else",
            bucketId: fallbackBucketId,
            priority: 1000,
            isFallback: true,
            conditions: "{}"
        });
}

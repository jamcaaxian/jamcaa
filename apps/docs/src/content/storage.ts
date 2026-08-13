import type { BucketSeed } from "@jamcaaxian/core/media";

/**
 * This site keeps its media in a bucket of the same account, so it is reached through
 * the binding declared in wrangler.jsonc. bucketName is still recorded because signing
 * an address for the browser to write to needs it.
 */
export const siteBuckets: BucketSeed[] = [
    { id: "media", label: "Site media", kind: "binding", binding: "MEDIA_BUCKET", bucketName: "jamcaa-docs-media" }
];

export const fallbackBucketId = "media";

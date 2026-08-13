import { createDatabase } from "@jamcaaxian/core";
import {
    createStorageConfiguration,
    seedStorage,
    StorageConfigurationError,
    type StorageConfiguration
} from "@jamcaaxian/core/media";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const seeds = [
    {
        id: "media",
        label: "Site media",
        kind: "binding" as const,
        binding: "MEDIA_BUCKET",
        bucketName: "jamcaa-docs-media"
    }
];

function database() {
    return createDatabase(env.DB);
}

function configuration(bindings: Record<string, unknown> = env as unknown as Record<string, unknown>) {
    return createStorageConfiguration({ database: database(), bindings });
}

async function expectCode(work: Promise<unknown>, code: string) {
    await expect(work).rejects.toMatchObject({ name: "StorageConfigurationError", code });
}

async function addBucket(target: StorageConfiguration, id = "archive", binding = "MEDIA_BUCKET") {
    await target.apply({
        type: "create-binding-bucket",
        bucket: { id, label: "Archive", binding, bucketName: "archive-media" }
    });
}

async function addRule(target: StorageConfiguration, label: string, mimePrefixes: string[]) {
    await target.apply({ type: "create-rule", rule: { label, bucketId: "archive", conditions: { mimePrefixes } } });
}

describe("administering storage configuration", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
        await seedStorage(database(), { buckets: seeds, fallbackBucketId: "media" });
    });

    it("reports safe usage and reachability without exposing credentials", async () => {
        await env.DB.prepare(
            "INSERT INTO bucket (id, label, kind, endpoint, bucket_name, access_key_id, secret_access_key) VALUES ('remote', 'Remote', 's3', 'https://s3.example.com', 'files', 'visible-key', 'secret-value')"
        ).run();

        const snapshot = await configuration().inspect();
        const media = snapshot.buckets.find(bucket => bucket.id === "media");
        const remote = snapshot.buckets.find(bucket => bucket.id === "remote");

        expect(media).toMatchObject({ reachable: true, ruleCount: 1, isFallbackTarget: true, mayDelete: false });
        expect(remote).toMatchObject({ reachable: true, mediaCount: 0, ruleCount: 0, mayDelete: true });
        expect(JSON.stringify(snapshot)).not.toContain("visible-key");
        expect(JSON.stringify(snapshot)).not.toContain("secret-value");
    });

    it("only registers a binding this deployment can actually reach", async () => {
        await expectCode(
            configuration({}).apply({
                type: "create-binding-bucket",
                bucket: { id: "archive", label: "Archive", binding: "ARCHIVE_BUCKET" }
            }),
            "binding-unavailable"
        );

        await addBucket(configuration());

        expect((await configuration().inspect()).buckets).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: "archive", binding: "MEDIA_BUCKET" })])
        );
    });

    it("normalises rule conditions and orders the fallback last", async () => {
        const target = configuration();
        await addBucket(target);
        await target.apply({
            type: "create-rule",
            rule: {
                label: "  Large images  ",
                bucketId: "archive",
                conditions: {
                    mimePrefixes: [" IMAGE/ ", "image/"],
                    tags: [" featured ", "featured", ""],
                    minSize: 1024,
                    from: "2026-08-09",
                    until: "2026-08-10"
                }
            }
        });

        const rules = (await target.inspect()).rules;

        expect(rules.map(rule => rule.isFallback)).toEqual([false, true]);
        expect(rules[0]).toMatchObject({
            label: "Large images",
            bucketId: "archive",
            conditions: {
                mimePrefixes: ["image/"],
                tags: ["featured"],
                minSize: 1024,
                from: "2026-08-09T00:00:00.000Z",
                until: "2026-08-10T23:59:59.999Z"
            }
        });
    });

    it("rejects conditions whose bounds contradict one another", async () => {
        const target = configuration();
        await addBucket(target);

        await expectCode(
            target.apply({
                type: "create-rule",
                rule: { label: "Impossible", bucketId: "archive", conditions: { minSize: 20, maxSize: 10 } }
            }),
            "invalid-conditions"
        );
    });

    it("moves the fallback but never lets it be edited or deleted as an ordinary rule", async () => {
        const target = configuration();
        await addBucket(target);
        await target.apply({ type: "update-fallback", bucketId: "archive" });

        const fallback = (await target.inspect()).rules.find(rule => rule.isFallback);
        expect(fallback?.bucketId).toBe("archive");

        await expectCode(target.apply({ type: "delete-rule", id: fallback!.id }), "fallback-rule-protected");
        await expectCode(
            target.apply({
                type: "update-rule",
                id: fallback!.id,
                rule: { label: "Not fallback", bucketId: "media", conditions: {} }
            }),
            "fallback-rule-protected"
        );
    });

    it("will not delete a bucket used by a rule or by pending media", async () => {
        const target = configuration();
        await addBucket(target);
        await addRule(target, "Images", ["image/"]);
        await expectCode(target.apply({ type: "delete-bucket", id: "archive" }), "bucket-in-use");

        const rule = (await target.inspect()).rules.find(candidate => !candidate.isFallback)!;
        await target.apply({ type: "delete-rule", id: rule.id });

        await env.DB.prepare(
            "INSERT INTO user (id, name, email, email_verified, updated_at) VALUES ('uploader', 'Uploader', 'storage@example.com', 1, 0)"
        ).run();
        await env.DB.prepare(
            "INSERT INTO media (id, bucket_id, object_key, filename, mime_type, size, state, uploader_id) VALUES ('pending-file', 'archive', 'pending', 'pending.png', 'image/png', 1, 'pending', 'uploader')"
        ).run();
        await expectCode(target.apply({ type: "delete-bucket", id: "archive" }), "bucket-in-use");
    });

    it("deletes an unused bucket without deleting the Cloudflare bucket", async () => {
        const target = configuration();
        await addBucket(target);
        await target.apply({ type: "delete-bucket", id: "archive" });

        expect((await target.inspect()).buckets.some(bucket => bucket.id === "archive")).toBe(false);
        expect(env.MEDIA_BUCKET).toBeDefined();
    });

    it("reorders every ordinary rule and rejects stale or incomplete orders", async () => {
        const target = configuration();
        await addBucket(target);
        await addRule(target, "Images", ["image/"]);
        await addRule(target, "Videos", ["video/"]);

        const before = (await target.inspect()).rules.filter(rule => !rule.isFallback);
        await target.apply({ type: "reorder-rules", orderedIds: [before[1]!.id, before[0]!.id] });

        const after = (await target.inspect()).rules.filter(rule => !rule.isFallback);
        expect(after.map(rule => rule.label)).toEqual(["Videos", "Images"]);
        expect(after.map(rule => rule.priority)).toEqual([10, 20]);

        await expectCode(target.apply({ type: "reorder-rules", orderedIds: [after[0]!.id] }), "invalid-order");
        await expectCode(
            target.apply({ type: "reorder-rules", orderedIds: [after[0]!.id, after[0]!.id] }),
            "invalid-order"
        );
    });

    it("rejects public addresses with credentials or query strings", async () => {
        const target = configuration();

        await expectCode(
            target.apply({
                type: "update-bucket",
                id: "media",
                label: "Site media",
                publicUrl: "https://user:pass@example.com/files?token=secret"
            }),
            "invalid-bucket"
        );
    });

    it("uses a stable domain error type", () => {
        const error = new StorageConfigurationError("invalid-order", "Reload.");

        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe("invalid-order");
    });
});

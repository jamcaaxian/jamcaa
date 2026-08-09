import { createDatabase } from "@jamcaa/core";
import { createAuth } from "@jamcaa/core/auth";
import {
    acceptUpload,
    beginUpload,
    cancelUpload,
    confirmUpload,
    listMedia,
    mediaById,
    objectKeyFor,
    reclaimAbandonedUploads,
    removeMedia,
    seedStorage
} from "@jamcaa/core/media";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const buckets = [
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

async function anUploader(email = "uploader@example.com") {
    const auth = createAuth({ database: database(), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
    const { user } = await auth.api.signUpEmail({
        body: { name: "Uploader", email, password: "correct-horse-battery-staple" }
    });

    return user.id;
}

function aFile(name = "cat.png", type = "image/png") {
    const body = new TextEncoder().encode("pretend this is an image").buffer as ArrayBuffer;

    return { name, type, size: body.byteLength, body };
}

function context(overrides: Partial<Parameters<typeof acceptUpload>[0]["context"]> = {}) {
    return { mimeType: "image/png", size: 24, at: new Date(Date.UTC(2026, 7, 9)), ...overrides };
}

describe("taking an upload", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });
    });

    it("puts the file in the bucket and records where it went", async () => {
        const uploaderId = await anUploader();

        const stored = await acceptUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            file: aFile(),
            context: context(),
            uploaderId
        });

        expect(stored).toMatchObject({ bucketId: "media", state: "stored", filename: "cat.png" });

        // The record is only worth anything if the object is really there.
        const object = await env.MEDIA_BUCKET.get(stored.objectKey);
        expect(object).not.toBeNull();
        expect(object?.httpMetadata?.contentType).toBe("image/png");
    });

    it("files it under the month it arrived, named so two of a name never contend", async () => {
        const uploaderId = await anUploader();

        const first = await acceptUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            file: aFile(),
            context: context(),
            uploaderId
        });
        const second = await acceptUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            file: aFile(),
            context: context(),
            uploaderId
        });

        expect(first.objectKey).toMatch(/^2026\/08\/.+-cat\.png$/);
        expect(second.objectKey).not.toBe(first.objectKey);
    });

    it("keeps a name written in another script", () => {
        const key = objectKeyFor({ id: "abc", filename: "你好，世界.PNG", at: new Date(Date.UTC(2026, 0, 5)) });

        expect(key).toBe("2026/01/abc-你好-世界.png");
    });

    it("leaves no record behind when nothing reached the bucket", async () => {
        const uploaderId = await anUploader();

        await expect(
            acceptUpload({
                database: database(),
                // The Worker has no such binding, so the write cannot happen.
                bindings: {},
                file: aFile(),
                context: context(),
                uploaderId
            })
        ).rejects.toThrow(/does not have/);

        expect(await listMedia(database())).toEqual([]);
        const rows = await env.DB.prepare("SELECT COUNT(*) AS total FROM media").first<{ total: number }>();
        expect(rows?.total).toBe(0);
    });

    it("prepares a direct upload and only publishes it after the object is confirmed", async () => {
        const uploaderId = await anUploader();
        const target = await beginUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            credentials: {
                accountId: "0123456789abcdef0123456789abcdef",
                accessKeyId: "test-access-key",
                secretAccessKey: "test-secret-key"
            },
            file: { name: "large-video.mp4", type: "video/mp4", size: 24 },
            context: context({ mimeType: "video/mp4", size: 24 }),
            uploaderId,
            expiresInSeconds: 300
        });

        expect(target).toMatchObject({ filename: "large-video.mp4", mimeType: "video/mp4", size: 24 });
        expect(new URL(target.putUrl).searchParams.get("X-Amz-Expires")).toBe("300");
        expect(await listMedia(database())).toEqual([]);

        await env.MEDIA_BUCKET.put(target.objectKey, "123456789012345678901234", {
            httpMetadata: { contentType: "video/mp4" }
        });

        const stored = await confirmUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            id: target.id,
            uploaderId
        });

        expect(stored).toMatchObject({ id: target.id, state: "stored", filename: "large-video.mp4" });
        expect(await listMedia(database())).toHaveLength(1);
    });

    it("refuses to confirm a direct upload when the object metadata does not match", async () => {
        const uploaderId = await anUploader();
        const target = await beginUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            credentials: {
                accountId: "0123456789abcdef0123456789abcdef",
                accessKeyId: "test-access-key",
                secretAccessKey: "test-secret-key"
            },
            file: { name: "cat.png", type: "image/png", size: 24 },
            context: context(),
            uploaderId,
            expiresInSeconds: 300
        });

        await env.MEDIA_BUCKET.put(target.objectKey, "wrong", { httpMetadata: { contentType: "text/plain" } });

        await expect(
            confirmUpload({
                database: database(),
                bindings: env as unknown as Record<string, unknown>,
                id: target.id,
                uploaderId
            })
        ).rejects.toThrow(/does not match/);

        expect((await mediaById(database(), target.id))?.state).toBe("pending");
    });

    it("does not let another uploader claim a pending upload", async () => {
        const uploaderId = await anUploader();
        const strangerId = await anUploader("stranger@example.com");
        const target = await beginUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            credentials: {
                accountId: "0123456789abcdef0123456789abcdef",
                accessKeyId: "test-access-key",
                secretAccessKey: "test-secret-key"
            },
            file: { name: "cat.png", type: "image/png", size: 24 },
            context: context(),
            uploaderId,
            expiresInSeconds: 300
        });

        await env.MEDIA_BUCKET.put(target.objectKey, "pretend this is an image", {
            httpMetadata: { contentType: "image/png" }
        });

        await expect(
            confirmUpload({
                database: database(),
                bindings: env as unknown as Record<string, unknown>,
                id: target.id,
                uploaderId: strangerId
            })
        ).rejects.toThrow(/does not belong/);
    });

    it("falls back cleanly when the chosen bucket cannot issue a direct address", async () => {
        const uploaderId = await anUploader();

        await expect(
            beginUpload({
                database: database(),
                bindings: env as unknown as Record<string, unknown>,
                file: { name: "cat.png", type: "image/png", size: 24 },
                context: context(),
                uploaderId,
                expiresInSeconds: 300
            })
        ).rejects.toThrow(/cannot accept a direct upload/);

        const rows = await env.DB.prepare("SELECT COUNT(*) AS total FROM media").first<{ total: number }>();
        expect(rows?.total).toBe(0);
    });

    it("cancels a direct attempt without leaving an object or pending record", async () => {
        const uploaderId = await anUploader();
        const target = await beginUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            credentials: {
                accountId: "0123456789abcdef0123456789abcdef",
                accessKeyId: "test-access-key",
                secretAccessKey: "test-secret-key"
            },
            file: { name: "cat.png", type: "image/png", size: 24 },
            context: context(),
            uploaderId,
            expiresInSeconds: 300
        });

        await env.MEDIA_BUCKET.put(target.objectKey, "partial");
        await cancelUpload({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            id: target.id,
            uploaderId
        });

        expect(await mediaById(database(), target.id)).toBeUndefined();
        expect(await env.MEDIA_BUCKET.get(target.objectKey)).toBeNull();
    });
});

describe("what the library shows and forgets", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });
    });

    it("does not show a file whose upload never finished", async () => {
        const uploaderId = await anUploader();

        await env.DB.prepare(
            "INSERT INTO media (id, bucket_id, object_key, filename, mime_type, size, state, uploader_id) VALUES ('half', 'media', 'k', 'half.png', 'image/png', 1, 'pending', ?)"
        )
            .bind(uploaderId)
            .run();

        expect(await listMedia(database())).toEqual([]);
    });

    it("removes the object as well as the record", async () => {
        const uploaderId = await anUploader();
        const bindings = env as unknown as Record<string, unknown>;

        const stored = await acceptUpload({
            database: database(),
            bindings,
            file: aFile(),
            context: context(),
            uploaderId
        });

        await removeMedia({ database: database(), bindings, id: stored.id });

        expect(await mediaById(database(), stored.id)).toBeUndefined();
        expect(await env.MEDIA_BUCKET.get(stored.objectKey)).toBeNull();
    });

    it("sweeps up uploads whose answer never arrived", async () => {
        const uploaderId = await anUploader();
        const bindings = env as unknown as Record<string, unknown>;

        await env.MEDIA_BUCKET.put("orphan", "content");
        await env.DB.prepare(
            "INSERT INTO media (id, bucket_id, object_key, filename, mime_type, size, state, uploader_id, created_at) VALUES ('orphan', 'media', 'orphan', 'o.png', 'image/png', 1, 'pending', ?, 0)"
        )
            .bind(uploaderId)
            .run();

        const swept = await reclaimAbandonedUploads({
            database: database(),
            bindings,
            olderThan: new Date(Date.UTC(2026, 0, 1))
        });

        expect(swept).toBe(1);
        expect(await env.MEDIA_BUCKET.get("orphan")).toBeNull();
    });

    it("leaves an upload that is merely still in progress", async () => {
        const uploaderId = await anUploader();

        await env.DB.prepare(
            "INSERT INTO media (id, bucket_id, object_key, filename, mime_type, size, state, uploader_id) VALUES ('fresh', 'media', 'fresh', 'f.png', 'image/png', 1, 'pending', ?)"
        )
            .bind(uploaderId)
            .run();

        const swept = await reclaimAbandonedUploads({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            olderThan: new Date(Date.UTC(2020, 0, 1))
        });

        expect(swept).toBe(0);
        expect(await mediaById(database(), "fresh")).toBeDefined();
    });
});

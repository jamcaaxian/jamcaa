import { createDatabase } from "@jamcaa/core";
import { createAuth } from "@jamcaa/core/auth";
import {
    acceptUpload,
    listMedia,
    mediaById,
    objectKeyFor,
    reclaimAbandonedUploads,
    removeMedia,
    seedStorage
} from "@jamcaa/core/media";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const buckets = [{ id: "media", label: "Site media", kind: "binding" as const, binding: "MEDIA_BUCKET" }];

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

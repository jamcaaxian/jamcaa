import { createDatabase } from "@jamcaa/core";
import { chooseRule, parseConditions, seedStorage, type StorageRule } from "@jamcaa/core/media";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const buckets = [
    { id: "media", label: "Site media", kind: "binding" as const, binding: "MEDIA_BUCKET" },
    { id: "video", label: "Video", kind: "binding" as const, binding: "VIDEO_BUCKET" }
];

function database() {
    return createDatabase(env.DB);
}

async function rulesFromDatabase(): Promise<StorageRule[]> {
    const rows = await env.DB.prepare("SELECT * FROM storage_rule").all<{
        id: string;
        label: string;
        bucket_id: string;
        priority: number;
        is_fallback: number;
        conditions: string;
    }>();

    return rows.results.flatMap(row => {
        const conditions = parseConditions(row.conditions);

        return conditions === undefined ?
                []
            :   [
                    {
                        id: row.id,
                        label: row.label,
                        bucketId: row.bucket_id,
                        priority: row.priority,
                        isFallback: row.is_fallback === 1,
                        conditions
                    }
                ];
    });
}

describe("setting up somewhere to put files", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
    });

    it("records the buckets and one rule to catch everything", async () => {
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });

        const stored = await env.DB.prepare("SELECT COUNT(*) AS total FROM bucket").first<{ total: number }>();
        const rules = await rulesFromDatabase();

        expect(stored?.total).toBe(2);
        expect(rules).toHaveLength(1);
        expect(rules[0]).toMatchObject({ isFallback: true, bucketId: "media" });
    });

    it("can be run again on a site that is already installed", async () => {
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });

        const rules = await rulesFromDatabase();
        const stored = await env.DB.prepare("SELECT COUNT(*) AS total FROM bucket").first<{ total: number }>();

        expect(stored?.total).toBe(2);
        expect(rules).toHaveLength(1);
    });

    it("refuses a fallback bucket that does not exist", async () => {
        await expect(seedStorage(database(), { buckets, fallbackBucketId: "nowhere" })).rejects.toThrow(
            /not among the buckets given/
        );
    });

    it("will not let a second fallback rule exist", async () => {
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });

        // ADR-0005 makes this the database's promise, not the code's good manners.
        await expect(
            env.DB.prepare(
                "INSERT INTO storage_rule (id, label, bucket_id, priority, is_fallback, conditions) VALUES ('second', 'Another', 'video', 0, 1, '{}')"
            ).run()
        ).rejects.toThrow(/UNIQUE constraint failed/i);
    });
});

describe("choosing where a file goes, against stored rules", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
        await seedStorage(database(), { buckets, fallbackBucketId: "media" });
    });

    it("sends a file nothing claims to the fallback bucket", async () => {
        const chosen = chooseRule(await rulesFromDatabase(), { mimeType: "image/png", size: 1_000, at: new Date() });

        expect(chosen.bucketId).toBe("media");
    });

    it("sends a file to the bucket whose rule claims it", async () => {
        await env.DB.prepare(
            "INSERT INTO storage_rule (id, label, bucket_id, priority, is_fallback, conditions) VALUES ('video', 'Video files', 'video', 10, 0, ?)"
        )
            .bind(JSON.stringify({ mimePrefixes: ["video/"] }))
            .run();

        const rules = await rulesFromDatabase();

        expect(chooseRule(rules, { mimeType: "video/mp4", size: 1_000, at: new Date() }).bucketId).toBe("video");
        expect(chooseRule(rules, { mimeType: "image/png", size: 1_000, at: new Date() }).bucketId).toBe("media");
    });

    it("leaves out a rule whose conditions cannot be read", async () => {
        await env.DB.prepare(
            "INSERT INTO storage_rule (id, label, bucket_id, priority, is_fallback, conditions) VALUES ('broken', 'Broken', 'video', 1, 0, 'not json')"
        ).run();

        // An unreadable rule must not become one that claims every file.
        expect(chooseRule(await rulesFromDatabase(), { mimeType: "image/png", size: 1, at: new Date() }).bucketId).toBe(
            "media"
        );
    });
});

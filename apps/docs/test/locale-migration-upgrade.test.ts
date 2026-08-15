import { createDatabase } from "@jamcaaxian/core";
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { pages } from "@/content/pages-store";
import { formerPostAddresses, posts } from "@/content/store";

const legacyPostId = "legacy-post";
const legacyPageId = "legacy-page";

describe("Locale content migration upgrade", () => {
    beforeAll(async () => {
        await applyD1Migrations(env.UPGRADE_DB, env.TEST_PRE_LOCALE_MIGRATIONS, "upgrade_migrations");
        await env.UPGRADE_DB.batch([
            env.UPGRADE_DB.prepare(
                "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1)"
            ).bind("legacy-author", "Legacy Author", "legacy@example.com"),
            env.UPGRADE_DB.prepare(
                `INSERT INTO post (
                    id, slug, status, author_id, category_id, created_at, updated_at, published_at,
                    title, excerpt, body__value, body__plain
                ) VALUES (?, ?, 'published', ?, ?, 1, 1, 1, ?, ?, ?, ?)`
            ).bind(
                legacyPostId,
                "guide",
                "legacy-author",
                "jamcaa-default-category",
                "Legacy guide",
                "Legacy excerpt",
                JSON.stringify({ version: 1, blocks: [] }),
                "legacy searchable phrase"
            ),
            env.UPGRADE_DB.prepare(
                "INSERT INTO page (id, title, address, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'published', 1, 1)"
            ).bind(legacyPageId, "Legacy home", "/", JSON.stringify({ version: 1, blocks: [] })),
            env.UPGRADE_DB.prepare(
                "INSERT INTO _jamcaa_post_former_address (path, entry_id, created_at) VALUES (?, ?, 1)"
            ).bind("/former-guide", legacyPostId)
        ]);

        const legacyIndex = await env.UPGRADE_DB.prepare(
            "SELECT entry_id FROM _jamcaa_post_fts WHERE _jamcaa_post_fts MATCH ?"
        )
            .bind('"legacy"')
            .first<{ entry_id: string }>();

        expect(legacyIndex?.entry_id).toBe(legacyPostId);

        await applyD1Migrations(env.UPGRADE_DB, env.TEST_LOCALE_MIGRATIONS, "upgrade_migrations");
    });

    it("backfills existing content identity to en-US", async () => {
        const post = await env.UPGRADE_DB.prepare("SELECT locale, translation_id FROM post WHERE id = ?")
            .bind(legacyPostId)
            .first<{ locale: string; translation_id: string }>();
        const page = await env.UPGRADE_DB.prepare("SELECT locale, translation_id FROM page WHERE id = ?")
            .bind(legacyPageId)
            .first<{ locale: string; translation_id: string }>();
        const former = await env.UPGRADE_DB.prepare(
            "SELECT locale, entry_id FROM _jamcaa_post_former_address WHERE path = ?"
        )
            .bind("/former-guide")
            .first<{ locale: string; entry_id: string }>();

        expect(post).toEqual({ locale: "en-US", translation_id: legacyPostId });
        expect(page).toEqual({ locale: "en-US", translation_id: legacyPageId });
        expect(former).toEqual({ locale: "en-US", entry_id: legacyPostId });
    });

    it("rebuilds FTS with the Locale partition and preserves searchable content", async () => {
        const columns = await env.UPGRADE_DB.prepare("PRAGMA table_info('_jamcaa_post_fts')").all<{ name: string }>();
        const indexed = await env.UPGRADE_DB.prepare(
            "SELECT entry_id, locale FROM _jamcaa_post_fts WHERE _jamcaa_post_fts MATCH ?"
        )
            .bind('"legacy"')
            .first<{ entry_id: string; locale: string }>();

        expect(columns.results.map(column => column.name)).toContain("locale");
        expect(indexed).toEqual({ entry_id: legacyPostId, locale: "en-US" });
    });

    it("allows matching addresses in another Locale after upgrade", async () => {
        const database = createDatabase(env.UPGRADE_DB);
        const english = await posts(database).byId(legacyPostId);

        expect(english).toBeDefined();

        const chinese = await posts(database).create({
            slug: "guide",
            locale: "zh-Hans-CN",
            translationId: english!.translationId,
            authorId: "legacy-author",
            categoryId: "jamcaa-default-category",
            status: "published",
            title: "指南",
            excerpt: null,
            body: { version: 1, blocks: [] }
        });
        const chinesePage = await pages(database).create({
            title: "首页",
            address: "/",
            locale: "zh-Hans-CN",
            translationId: legacyPageId,
            status: "published",
            body: { version: 1, blocks: [] }
        });

        await formerPostAddresses(database).retain(chinese.id, "/former-guide", "zh-Hans-CN");

        expect(chinese.slug).toBe("guide");
        expect(chinesePage.status).toBe("created");
        await expect(formerPostAddresses(database).entryAt("/former-guide", "en-US")).resolves.toBe(legacyPostId);
        await expect(formerPostAddresses(database).entryAt("/former-guide", "zh-Hans-CN")).resolves.toBe(chinese.id);
    });
});

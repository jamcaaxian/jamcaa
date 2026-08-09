import { createDatabase } from "@jamcaa/core";
import { checkRequirements, ensureInstalled, INSTALL_VERSION } from "@jamcaa/core/install";
import { coreSettings, forgetCachedSettings, loadSettings } from "@jamcaa/core/settings";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { installPlan } from "@/content/install";
import { siteSettings } from "@/content/settings";

function database() {
    return createDatabase(env.DB);
}

describe("bringing a site up to date", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM media");
        await env.DB.exec("DELETE FROM storage_rule");
        await env.DB.exec("DELETE FROM bucket");
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
        await env.DB.exec("DELETE FROM setting");
        forgetCachedSettings();
    });

    it("puts in place everything a site needs to be used", async () => {
        const report = await ensureInstalled(database(), installPlan);

        const roles = await env.DB.prepare("SELECT COUNT(*) AS total FROM role").first<{ total: number }>();
        const rules = await env.DB.prepare("SELECT COUNT(*) AS total FROM storage_rule WHERE is_fallback = 1").first<{
            total: number;
        }>();

        expect(report).toMatchObject({ from: 0, to: INSTALL_VERSION, ran: true });
        expect(roles?.total).toBeGreaterThan(0);
        expect(rules?.total).toBe(1);
    });

    it("does nothing the second time", async () => {
        await ensureInstalled(database(), installPlan);
        forgetCachedSettings();

        expect(await ensureInstalled(database(), installPlan)).toMatchObject({ ran: false });
    });

    it("catches up a site installed before a step existed", async () => {
        // What an existing site looks like: accounts and content, but no storage.
        await env.DB.prepare("INSERT INTO setting (key, value) VALUES ('platform.installedVersion', '0')").run();
        forgetCachedSettings();

        await ensureInstalled(database(), installPlan);

        const buckets = await env.DB.prepare("SELECT COUNT(*) AS total FROM bucket").first<{ total: number }>();
        expect(buckets?.total).toBe(installPlan.buckets.length);
    });

    it("records what it has run so the next visit is free", async () => {
        await ensureInstalled(database(), installPlan);
        forgetCachedSettings();

        const settings = await loadSettings(database(), coreSettings);
        expect(settings.get("platform.installedVersion")).toBe(INSTALL_VERSION);
    });
});

describe("what a deployment is told it still needs", () => {
    it("is satisfied when everything is in place", async () => {
        const requirements = await checkRequirements({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            settings: siteSettings,
            plan: installPlan,
            authSecret: env.BETTER_AUTH_SECRET,
            authUrl: env.BETTER_AUTH_URL
        });

        expect(requirements.filter(requirement => !requirement.met)).toEqual([]);
    });

    it("names the missing binding rather than failing on first upload", async () => {
        const requirements = await checkRequirements({
            database: database(),
            bindings: {},
            settings: siteSettings,
            plan: installPlan,
            authSecret: env.BETTER_AUTH_SECRET,
            authUrl: env.BETTER_AUTH_URL
        });

        const missing = requirements.find(requirement => !requirement.met);

        expect(missing?.name).toMatch(/MEDIA_BUCKET/);
        expect(missing?.remedy).toMatch(/wrangler\.jsonc/);
    });

    it("objects to a signing secret too short to be one", async () => {
        const requirements = await checkRequirements({
            database: database(),
            bindings: env as unknown as Record<string, unknown>,
            settings: siteSettings,
            plan: installPlan,
            authSecret: "short",
            authUrl: env.BETTER_AUTH_URL
        });

        const secret = requirements.find(requirement => requirement.name.includes("signing secret"));

        expect(secret?.met).toBe(false);
        expect(secret?.remedy).toMatch(/openssl rand/);
    });
});

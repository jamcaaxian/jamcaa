import { createDatabase } from "@jamcaaxian/core";
import { coreCapabilities } from "@jamcaaxian/core/auth";
import { checkRequirements, ensureInstalled, INSTALL_VERSION } from "@jamcaaxian/core/install";
import { coreSettings, forgetCachedSettings, loadSettings } from "@jamcaaxian/core/settings";
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

    it("adds new system grants without removing an existing Site grant", async () => {
        await env.DB.prepare(
            "INSERT INTO role (name, label, description, is_system) VALUES ('editor', 'Editor', 'Existing editor', 1)"
        ).run();
        await env.DB.prepare(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('editor', 'newsletter', 'send')"
        ).run();
        await env.DB.prepare(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('editor', 'settings', 'read')"
        ).run();
        await env.DB.exec("DELETE FROM role_capability WHERE role_name = 'editor' AND resource = 'settings'");
        await env.DB.prepare("INSERT INTO setting (key, value) VALUES ('platform.installedVersion', '1')").run();
        forgetCachedSettings();

        await ensureInstalled(database(), installPlan);

        const grants = await env.DB.prepare(
            "SELECT resource, action FROM role_capability WHERE role_name = 'editor' ORDER BY resource, action"
        ).all<{ resource: string; action: string }>();
        expect(grants.results).toContainEqual({ resource: "taxonomy", action: "manage" });
        expect(grants.results).toContainEqual({ resource: "newsletter", action: "send" });
        expect(grants.results).not.toContainEqual({ resource: "settings", action: "read" });
    });

    it("adds only Role recovery grants when upgrading a version 2 site", async () => {
        await ensureInstalled(database(), installPlan);
        await env.DB.exec(
            "DELETE FROM role_capability WHERE (role_name = 'admin' AND resource = 'settings' AND action = 'manage') OR (role_name = 'editor' AND resource = 'settings' AND action = 'read')"
        );
        await env.DB.prepare(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('editor', 'newsletter', 'send')"
        ).run();
        await env.DB.exec("DELETE FROM role_capability WHERE resource = 'role'");
        await env.DB.prepare("UPDATE setting SET value = '2' WHERE key = 'platform.installedVersion'").run();
        forgetCachedSettings();

        await ensureInstalled(database(), installPlan);

        const grants = await env.DB.prepare(
            "SELECT role_name AS roleName, resource, action FROM role_capability ORDER BY role_name, resource, action"
        ).all<{ roleName: string; resource: string; action: string }>();

        expect(grants.results).toContainEqual({ roleName: "admin", resource: "role", action: "read" });
        expect(grants.results).toContainEqual({ roleName: "admin", resource: "role", action: "manage" });
        expect(grants.results).not.toContainEqual({ roleName: "admin", resource: "settings", action: "manage" });
        expect(grants.results).not.toContainEqual({ roleName: "editor", resource: "settings", action: "read" });
        expect(grants.results).toContainEqual({ roleName: "editor", resource: "newsletter", action: "send" });
        expect(grants.results.some(grant => grant.roleName !== "admin" && grant.resource === "role")).toBe(false);
    });

    it("adds every Page capability to an administrator upgrading from version 3", async () => {
        await ensureInstalled(database(), installPlan);
        await env.DB.exec("DELETE FROM role_capability WHERE role_name = 'admin' AND resource = 'page'");
        await env.DB.prepare("UPDATE setting SET value = '3' WHERE key = 'platform.installedVersion'").run();
        forgetCachedSettings();

        await ensureInstalled(database(), installPlan);

        const grants = await env.DB.prepare(
            "SELECT action FROM role_capability WHERE role_name = 'admin' AND resource = 'page' ORDER BY action"
        ).all<{ action: string }>();

        expect(grants.results.map(grant => grant.action)).toEqual([...coreCapabilities.page].sort());
    });

    it("adds Console access to existing authoring Roles when upgrading from version 4", async () => {
        await ensureInstalled(database(), installPlan);
        await env.DB.exec("DELETE FROM role_capability WHERE resource = 'console'");
        await env.DB.prepare("UPDATE setting SET value = '4' WHERE key = 'platform.installedVersion'").run();
        forgetCachedSettings();

        await ensureInstalled(database(), installPlan);

        const grants = await env.DB.prepare(
            "SELECT role_name AS roleName FROM role_capability WHERE resource = 'console' AND action = 'access' ORDER BY role_name"
        ).all<{ roleName: string }>();

        expect(grants.results.map(grant => grant.roleName)).toEqual(["admin", "author", "contributor", "editor"]);
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

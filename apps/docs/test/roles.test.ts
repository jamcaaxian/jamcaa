import { createDatabase } from "@jamcaaxian/core";
import {
    buildAccessControl,
    coreCapabilities,
    forgetCachedRoleGrants,
    grantEverything,
    getRoleGrants,
    inspectSystemRoleGrants,
    loadRoleGrants,
    replaceSystemRoleGrants,
    ROLE_CACHE_TTL_MS,
    seedSystemRoles,
    systemRoles
} from "@jamcaaxian/core/auth";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

function database() {
    return createDatabase(env.DB);
}

async function seededRoles() {
    const grants = await loadRoleGrants(database());
    return buildAccessControl(coreCapabilities, grants).roles;
}

describe("system roles", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
        await seedSystemRoles(database(), coreCapabilities);
    });

    it("seeds every system role", async () => {
        const rows = await env.DB.prepare("SELECT name FROM role ORDER BY name").all<{ name: string }>();

        expect(rows.results.map(row => row.name).sort()).toEqual(systemRoles.map(role => role.name).sort());
    });

    it("leaves an edited role alone when seeding runs again", async () => {
        await env.DB.exec("DELETE FROM role_capability WHERE role_name = 'editor'");

        await seedSystemRoles(database(), coreCapabilities);

        const grants = await loadRoleGrants(database());
        expect(grants.editor).toEqual({});
    });

    it("grants the administrator the whole catalogue", async () => {
        const grants = await loadRoleGrants(database());

        for (const [resource, actions] of Object.entries(coreCapabilities)) {
            expect(grants.admin?.[resource]?.sort()).toEqual([...actions].sort());
        }
    });
});

describe("authorization from database-defined roles", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
        await seedSystemRoles(database(), coreCapabilities);
    });

    it("lets an author publish their own post", async () => {
        const roles = await seededRoles();

        expect(roles.author?.authorize({ post: ["publish-own"] }).success).toBe(true);
    });

    it("stops a contributor publishing anything", async () => {
        const roles = await seededRoles();

        expect(roles.contributor?.authorize({ post: ["publish-own"] }).success).toBe(false);
        expect(roles.contributor?.authorize({ post: ["publish-any"] }).success).toBe(false);
    });

    it("separates editing your own post from editing anyone's", async () => {
        const roles = await seededRoles();

        expect(roles.author?.authorize({ post: ["update-own"] }).success).toBe(true);
        expect(roles.author?.authorize({ post: ["update-any"] }).success).toBe(false);
        expect(roles.editor?.authorize({ post: ["update-any"] }).success).toBe(true);
    });

    it("keeps user management away from everyone but the administrator", async () => {
        const roles = await seededRoles();

        expect(roles.admin?.authorize({ user: ["ban"] }).success).toBe(true);
        expect(roles.editor?.authorize({ user: ["ban"] }).success).toBe(false);
        expect(roles.subscriber?.authorize({ user: ["list"] }).success).toBe(false);
    });

    it("reflects a grant added in the database without redeploying", async () => {
        const before = await seededRoles();
        expect(before.contributor?.authorize({ post: ["publish-own"] }).success).toBe(false);

        await env.DB.exec(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('contributor', 'post', 'publish-own')"
        );

        const after = await seededRoles();
        expect(after.contributor?.authorize({ post: ["publish-own"] }).success).toBe(true);
    });
});

describe("role grant cache", () => {
    beforeEach(async () => {
        forgetCachedRoleGrants();
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
    });

    it("reports nothing for an unseeded database so the core uses its own defaults", async () => {
        await expect(getRoleGrants(database())).resolves.toBeUndefined();
    });

    it("returns the seeded grants", async () => {
        await seedSystemRoles(database(), coreCapabilities);

        const grants = await getRoleGrants(database());

        expect(grants?.contributor).toBeDefined();
    });

    it("keeps a seeded role with no grants instead of falling back to defaults", async () => {
        await seedSystemRoles(database(), coreCapabilities);
        await env.DB.exec("DELETE FROM role_capability WHERE role_name = 'contributor'");

        const grants = await getRoleGrants(database());

        expect(grants?.contributor).toEqual({});
    });

    it("keeps serving the previous grants until the entry expires", async () => {
        await seedSystemRoles(database(), coreCapabilities);
        const start = Date.now();
        await getRoleGrants(database(), start);

        await env.DB.exec(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('contributor', 'post', 'publish-own')"
        );

        const stale = await getRoleGrants(database(), start + ROLE_CACHE_TTL_MS - 1);
        expect(stale?.contributor?.post).not.toContain("publish-own");

        const fresh = await getRoleGrants(database(), start + ROLE_CACHE_TTL_MS + 1);
        expect(fresh?.contributor?.post).toContain("publish-own");
    });

    it("drops the entry on request", async () => {
        await seedSystemRoles(database(), coreCapabilities);
        const start = Date.now();
        await getRoleGrants(database(), start);

        await env.DB.exec(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('subscriber', 'post', 'create')"
        );
        forgetCachedRoleGrants();

        const grants = await getRoleGrants(database(), start);
        expect(grants?.subscriber?.post).toContain("create");
    });
});

describe("system role grant editor", () => {
    beforeEach(async () => {
        forgetCachedRoleGrants();
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
        await seedSystemRoles(database(), coreCapabilities);
    });

    it("inspects the declared capabilities and current system Role grants", async () => {
        const model = await inspectSystemRoleGrants(database(), coreCapabilities);

        expect(model.catalogue.role).toEqual(["read", "manage"]);
        expect(model.roles.find(role => role.name === "contributor")?.grants.post).toContain("create");
    });

    it("atomically replaces one system Role's grants and clears the current cache", async () => {
        const start = Date.now();
        await getRoleGrants(database(), start);

        await replaceSystemRoleGrants(database(), coreCapabilities, "contributor", { post: ["read"], role: ["read"] });

        await expect(getRoleGrants(database(), start)).resolves.toMatchObject({
            contributor: { post: ["read"], role: ["read"] }
        });
    });

    it("replaces an administrator grant set larger than D1's bound-parameter limit", async () => {
        await replaceSystemRoleGrants(database(), coreCapabilities, "admin", grantEverything(coreCapabilities));

        const grants = await loadRoleGrants(database());

        for (const [resource, actions] of Object.entries(coreCapabilities)) {
            expect(grants.admin?.[resource]?.sort()).toEqual([...actions].sort());
        }
    });

    it("refuses unknown capabilities without changing existing grants", async () => {
        const before = await loadRoleGrants(database());

        await expect(
            replaceSystemRoleGrants(database(), coreCapabilities, "contributor", { post: ["destroy"] })
        ).rejects.toThrow(/Unknown capability action/);

        await expect(loadRoleGrants(database())).resolves.toEqual(before);
    });

    it("refuses a Role that is not a system Role", async () => {
        await env.DB.prepare(
            "INSERT INTO role (name, label, description, is_system) VALUES ('custom', 'Custom', NULL, 0)"
        ).run();

        await expect(
            replaceSystemRoleGrants(database(), coreCapabilities, "custom", { post: ["read"] })
        ).rejects.toThrow(/system Role/);
    });

    it("keeps the administrator's Role recovery capabilities even when omitted", async () => {
        await replaceSystemRoleGrants(database(), coreCapabilities, "admin", { post: ["read"] });

        const grants = await loadRoleGrants(database());
        expect(grants.admin).toEqual({ post: ["read"], role: ["manage", "read"] });
    });
});

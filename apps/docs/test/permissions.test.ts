import { createDatabase } from "@jamcaa/core";
import {
    actorMay,
    actorMayTouch,
    coreCapabilities,
    createAuth,
    loadRoleGrants,
    seedSystemRoles
} from "@jamcaa/core/auth";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const SOMEONE_ELSE = "another-author";
const SELF = "me";

async function authWithSeededRoles() {
    const database = createDatabase(env.DB);

    await seedSystemRoles(database, coreCapabilities);

    return createAuth({
        database,
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        roleGrants: await loadRoleGrants(database)
    });
}

describe("what each role may do with posts", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
    });

    it("lets a contributor write but not publish", async () => {
        const auth = await authWithSeededRoles();
        const actor = { id: SELF, role: "contributor" };

        expect(await actorMay({ auth, actor, resource: "post", action: "create" })).toBe(true);
        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "update", ownerId: SELF })).toBe(true);
        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "publish", ownerId: SELF })).toBe(false);
    });

    it("lets an author publish their own work only", async () => {
        const auth = await authWithSeededRoles();
        const actor = { id: SELF, role: "author" };

        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "publish", ownerId: SELF })).toBe(true);
        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "publish", ownerId: SOMEONE_ELSE })).toBe(
            false
        );
        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "update", ownerId: SOMEONE_ELSE })).toBe(
            false
        );
    });

    it("lets an editor work on anyone's posts", async () => {
        const auth = await authWithSeededRoles();
        const actor = { id: SELF, role: "editor" };

        for (const verb of ["update", "delete", "publish"]) {
            expect(await actorMayTouch({ auth, actor, resource: "post", verb, ownerId: SOMEONE_ELSE })).toBe(true);
        }
    });

    it("keeps a subscriber out of the editing surface entirely", async () => {
        const auth = await authWithSeededRoles();
        const actor = { id: SELF, role: "subscriber" };

        expect(await actorMay({ auth, actor, resource: "post", action: "read" })).toBe(true);
        expect(await actorMay({ auth, actor, resource: "post", action: "create" })).toBe(false);
        expect(await actorMayTouch({ auth, actor, resource: "post", verb: "update", ownerId: SELF })).toBe(false);
    });

    it("refuses someone with no role at all", async () => {
        const auth = await authWithSeededRoles();
        const actor = { id: SELF, role: null };

        expect(await actorMay({ auth, actor, resource: "post", action: "read" })).toBe(false);
    });

    it("follows the database when a role's grants are changed", async () => {
        const database = createDatabase(env.DB);

        await seedSystemRoles(database, coreCapabilities);
        await env.DB.prepare(
            "INSERT INTO role_capability (role_name, resource, action) VALUES ('contributor', 'post', 'publish-own')"
        ).run();

        const auth = createAuth({
            database,
            secret: env.BETTER_AUTH_SECRET,
            baseURL: env.BETTER_AUTH_URL,
            roleGrants: await loadRoleGrants(database)
        });

        expect(
            await actorMayTouch({
                auth,
                actor: { id: SELF, role: "contributor" },
                resource: "post",
                verb: "publish",
                ownerId: SELF
            })
        ).toBe(true);
    });
});

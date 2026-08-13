import { createDatabase } from "@jamcaaxian/core";
import { claimFirstAdministrator, createAuth, hasAdministrator } from "@jamcaaxian/core/auth";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next-path";

function database() {
    return createDatabase(env.DB);
}

function auth() {
    return createAuth({ database: database(), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
}

const founder = { name: "Founder", email: "founder@example.com", password: "correct-horse-battery-staple" };

describe("first-run installation", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
        await env.DB.exec("DELETE FROM role_capability");
        await env.DB.exec("DELETE FROM role");
    });

    it("reports an empty installation", async () => {
        expect(await hasAdministrator(database())).toBe(false);
    });

    it("makes the first account an administrator", async () => {
        const result = await claimFirstAdministrator({ auth: auth(), database: database(), ...founder });

        expect(result.status).toBe("created");

        const stored = await env.DB.prepare("SELECT role FROM user").first<{ role: string }>();
        expect(stored?.role).toBe("admin");
    });

    it("seeds the system roles so the installation is usable immediately", async () => {
        await claimFirstAdministrator({ auth: auth(), database: database(), ...founder });

        const roles = await env.DB.prepare("SELECT name FROM role").all<{ name: string }>();
        expect(roles.results.map(row => row.name)).toContain("admin");
    });

    it("refuses once an administrator exists", async () => {
        await claimFirstAdministrator({ auth: auth(), database: database(), ...founder });

        const second = await claimFirstAdministrator({
            auth: auth(),
            database: database(),
            name: "Interloper",
            email: "interloper@example.com",
            password: "correct-horse-battery-staple"
        });

        expect(second.status).toBe("already-installed");

        const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM user").first<{ total: number }>();
        expect(total?.total).toBe(1);
    });

    it("ignores accounts that are not administrators", async () => {
        await env.DB.prepare(
            "INSERT INTO user (id, name, email, email_verified) VALUES ('docs-author', 'Documentation', 'docs@jamcaa.local', 1)"
        ).run();

        expect(await hasAdministrator(database())).toBe(false);

        const result = await claimFirstAdministrator({ auth: auth(), database: database(), ...founder });
        expect(result.status).toBe("created");

        const admins = await env.DB.prepare("SELECT COUNT(*) AS total FROM user WHERE role = 'admin'").first<{
            total: number;
        }>();
        expect(admins?.total).toBe(1);
    });

    it("does not create an account when sign-up is rejected", async () => {
        const result = await claimFirstAdministrator({
            auth: auth(),
            database: database(),
            ...founder,
            password: "short"
        });

        expect(result.status).toBe("rejected");
        expect(await hasAdministrator(database())).toBe(false);
    });
});

describe("safeNextPath", () => {
    it("keeps an in-site path", () => {
        expect(safeNextPath("/admin/posts")).toBe("/admin/posts");
    });

    it("falls back when nothing was asked for", () => {
        expect(safeNextPath(undefined)).toBe("/admin");
        expect(safeNextPath("")).toBe("/admin");
    });

    it("refuses to send the visitor off-site", () => {
        // Every one of these is read as an absolute destination by some browser.
        expect(safeNextPath("//evil.example")).toBe("/admin");
        expect(safeNextPath("/\\evil.example")).toBe("/admin");
        expect(safeNextPath("https://evil.example")).toBe("/admin");
        expect(safeNextPath("javascript:alert(1)")).toBe("/admin");
    });
});

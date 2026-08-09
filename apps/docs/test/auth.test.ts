import { createDatabase } from "@jamcaa/core";
import { createAuth } from "@jamcaa/core/auth";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

function auth() {
    return createAuth({
        database: createDatabase(env.DB),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL
    });
}

const credentials = { email: "editor@example.com", password: "correct-horse-battery-staple", name: "Editor" };

describe("email and password authentication", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("creates a user and issues a session on sign-up", async () => {
        const result = await auth().api.signUpEmail({ body: credentials });

        expect(result.user.email).toBe(credentials.email);
        expect(result.token).toBeTruthy();

        const stored = await env.DB.prepare("SELECT email FROM user").first<{ email: string }>();
        expect(stored?.email).toBe(credentials.email);
    });

    it("accepts the correct password", async () => {
        await auth().api.signUpEmail({ body: credentials });

        const result = await auth().api.signInEmail({
            body: { email: credentials.email, password: credentials.password }
        });

        expect(result.user.email).toBe(credentials.email);
    });

    it("rejects the wrong password", async () => {
        await auth().api.signUpEmail({ body: credentials });

        await expect(
            auth().api.signInEmail({ body: { email: credentials.email, password: "not-the-password" } })
        ).rejects.toThrow();
    });

    it("does not store the password in recoverable form", async () => {
        await auth().api.signUpEmail({ body: credentials });

        const stored = await env.DB.prepare("SELECT password FROM account").first<{ password: string }>();

        expect(stored?.password).toBeTruthy();
        expect(stored?.password).not.toContain(credentials.password);
    });
});

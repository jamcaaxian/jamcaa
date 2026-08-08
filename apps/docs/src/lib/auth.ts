import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@jamcaa/core/auth";
import { createDatabase } from "@jamcaa/core";
import { nextCookies } from "better-auth/next-js";

/**
 * Built per request: runtime bindings are only reachable inside a request context,
 * so there is no module-scope instance to hand out.
 */
export async function getAuth() {
    const { env } = getCloudflareContext();

    return createAuth({
        database: createDatabase(env.DB),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        // Bridges Set-Cookie headers into Next's cookie store; must stay last.
        plugins: [nextCookies()]
    });
}

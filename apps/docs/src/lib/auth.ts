import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth, getRoleGrants } from "@jamcaa/core/auth";
import { createDatabase } from "@jamcaa/core";
import { nextCookies } from "better-auth/next-js";

/**
 * Built per request: runtime bindings are only reachable inside a request context,
 * so there is no module-scope instance to hand out.
 */
export async function getAuth() {
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);

    return createAuth({
        database,
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        // Undefined until the roles are seeded, at which point the core falls back
        // to the system roles it defines in code.
        roleGrants: await getRoleGrants(database),
        // Bridges Set-Cookie headers into Next's cookie store; must stay last.
        plugins: [nextCookies()]
    });
}

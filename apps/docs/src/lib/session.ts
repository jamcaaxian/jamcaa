import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { hasAdministrator } from "@jamcaa/core/auth";
import { getAuth } from "./auth";

export async function getSession() {
    const auth = await getAuth();

    return auth.api.getSession({ headers: await headers() });
}

/**
 * The proxy only checks that a session cookie exists, which anyone can forge.
 * This is where a protected route learns whether the session is real.
 */
export async function requireSession() {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    return session;
}

export async function isInstalled() {
    const { env } = getCloudflareContext();

    return hasAdministrator(createDatabase(env.DB));
}

export { safeNextPath } from "./safe-next-path";

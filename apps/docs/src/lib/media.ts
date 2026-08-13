import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import type { SigningCredentials } from "@jamcaaxian/core/media";

/** What the media layer needs from the runtime, gathered in one place per request. */
export function mediaRuntime() {
    const { env } = getCloudflareContext();

    const credentials: SigningCredentials | undefined =
        env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY ?
            {
                accountId: env.R2_ACCOUNT_ID,
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY
            }
            // Without these the browser cannot be handed an address to write to, and
            // uploads go through the server only.
        :   undefined;

    return { database: createDatabase(env.DB), bindings: env as unknown as Record<string, unknown>, credentials };
}

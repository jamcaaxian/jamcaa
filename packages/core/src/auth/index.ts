import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import type { BetterAuthPlugin } from "better-auth";
import type { Database } from "../db/client";
import * as schema from "../db/schema/index";

export interface AuthOptions {
    database: Database;
    /** At least 32 characters. Read from configuration, never hard-coded. */
    secret: string;
    baseURL: string;
    /** Host-specific plugins, such as the framework's cookie bridge. */
    plugins?: BetterAuthPlugin[];
}

/**
 * The platform's authentication policy lives here so every site inherits the same
 * rules. The database arrives as an argument because runtime bindings are only
 * available per request (ADR-0010).
 */
export function createAuth(options: AuthOptions) {
    return betterAuth({
        database: drizzleAdapter(options.database, {
            provider: "sqlite",
            schema
        }),
        secret: options.secret,
        baseURL: options.baseURL,
        emailAndPassword: {
            enabled: true
        },
        plugins: options.plugins ?? []
    });
}

export type Auth = ReturnType<typeof createAuth>;

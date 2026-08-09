import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import type { BetterAuthPlugin } from "better-auth";
import type { Database } from "../db/client";
import * as schema from "../db/schema/index";
import { coreCapabilities, type CapabilityCatalogue, type CapabilityGrants } from "./capabilities";
import { buildAccessControl, grantEverything, systemRoles } from "./roles";

export interface AuthOptions {
    database: Database;
    /** At least 32 characters. Read from configuration, never hard-coded. */
    secret: string;
    baseURL: string;
    /** Defaults to the core catalogue; sites extend it with plugin contributions. */
    capabilities?: CapabilityCatalogue;
    /**
     * Loaded from the database at request time. Falls back to the system roles so
     * that schema generation and a freshly seeded database behave alike.
     */
    roleGrants?: Record<string, CapabilityGrants>;
    /** Host-specific plugins, such as the framework's cookie bridge. */
    plugins?: BetterAuthPlugin[];
}

function defaultRoleGrants(catalogue: CapabilityCatalogue): Record<string, CapabilityGrants> {
    return Object.fromEntries(
        systemRoles.map(systemRole => [systemRole.name, systemRole.grants ?? grantEverything(catalogue)])
    );
}

/**
 * The platform's authentication policy lives here so every site inherits the same
 * rules. The database arrives as an argument because runtime bindings are only
 * available per request (ADR-0010).
 */
export function createAuth(options: AuthOptions) {
    const capabilities = options.capabilities ?? coreCapabilities;
    const { accessControl, roles } = buildAccessControl(
        capabilities,
        options.roleGrants ?? defaultRoleGrants(capabilities)
    );

    return betterAuth({
        database: drizzleAdapter(options.database, { provider: "sqlite", schema }),
        secret: options.secret,
        baseURL: options.baseURL,
        emailAndPassword: { enabled: true },
        plugins: [
            // The catalogue declares no impersonation actions, so no role can be
            // granted them and the plugin's impersonation endpoints stay closed.
            admin({ ac: accessControl, roles, defaultRole: "subscriber", adminRoles: ["admin"] }),
            ...(options.plugins ?? [])
        ]
    });
}

export type Auth = ReturnType<typeof createAuth>;

export * from "./bootstrap";
export * from "./capabilities";
export * from "./permissions";
export * from "./role-cache";
export * from "./roles";

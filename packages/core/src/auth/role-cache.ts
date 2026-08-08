import type { Database } from "../db/client";
import type { CapabilityGrants } from "./capabilities";
import { loadRoleGrants } from "./roles";

interface CacheEntry {
    grants: Record<string, CapabilityGrants>;
    expiresAt: number;
}

let cached: CacheEntry | undefined;

/** How long a worker may reuse role grants before reading them again. */
export const ROLE_CACHE_TTL_MS = 30_000;

/**
 * Grants are read on nearly every authenticated request, and the database serves
 * queries one at a time, so they are held briefly in memory.
 *
 * The cache is per worker instance: after an administrator edits a role, instances
 * that have not yet expired keep serving the previous grants for up to the TTL.
 * That staleness is the price of not querying on every request; permission changes
 * are not expected to need immediate global effect.
 */
export async function getRoleGrants(
    database: Database,
    now: number = Date.now()
): Promise<Record<string, CapabilityGrants> | undefined> {
    if (cached && cached.expiresAt > now) {
        return cached.grants;
    }

    const grants = await loadRoleGrants(database);

    // An unseeded database falls back to the system roles defined in code.
    if (Object.keys(grants).length === 0) {
        cached = undefined;
        return undefined;
    }

    cached = { grants, expiresAt: now + ROLE_CACHE_TTL_MS };
    return grants;
}

/** Call after writing role grants so the current worker stops serving the old set. */
export function forgetCachedRoleGrants(): void {
    cached = undefined;
}

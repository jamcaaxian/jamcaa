import { coreCapabilities, seedSystemRoles, syncSystemRoleGrants, type CapabilityCatalogue } from "../auth";
import type { Database } from "../db/client";
import { seedStorage, type BucketSeed } from "../media/install";
import { coreSettings, type SettingCatalogue } from "../settings/definitions";
import { loadSettings, writeSettings } from "../settings/store";

/**
 * Raised when a step is added that a site installed under an earlier version has
 * never run. Sites are upgraded by running the same routine, not by remembering to
 * do something by hand.
 */
export const INSTALL_VERSION = 2;

export interface InstallPlan {
    buckets: readonly BucketSeed[];
    fallbackBucketId: string;
    /** Defaults to the core catalogue; sites extend it with plugin contributions. */
    capabilities?: CapabilityCatalogue;
}

export interface InstallReport {
    from: number;
    to: number;
    ran: boolean;
}

/**
 * Everything a site needs in place before it can be used, written in a way that is
 * safe to run again. Called when the first administrator is claimed, and on every
 * admin request thereafter, where it costs one cached read and does nothing.
 */
export async function ensureInstalled(database: Database, plan: InstallPlan): Promise<InstallReport> {
    const settings = await loadSettings(database, coreSettings);
    const from = settings.get("platform.installedVersion");

    if (from >= INSTALL_VERSION) {
        return { from, to: from, ran: false };
    }

    await seedSystemRoles(database, plan.capabilities ?? coreCapabilities);
    await syncSystemRoleGrants(database, plan.capabilities ?? coreCapabilities);
    await seedStorage(database, { buckets: plan.buckets, fallbackBucketId: plan.fallbackBucketId });

    await writeSettings(database, coreSettings, { "platform.installedVersion": INSTALL_VERSION });

    return { from, to: INSTALL_VERSION, ran: true };
}

export interface Requirement {
    name: string;
    met: boolean;
    /** What to do about it, addressed to whoever is deploying. */
    remedy: string;
}

/**
 * What a deployment needs before anyone can sign in. Reported all at once rather
 * than one failure at a time, so a first deployment can be fixed in one pass.
 */
export async function checkRequirements(options: {
    database: Database;
    bindings: Record<string, unknown>;
    settings: SettingCatalogue;
    plan: InstallPlan;
    authSecret: string | undefined;
    authUrl: string | undefined;
}): Promise<Requirement[]> {
    const requirements: Requirement[] = [];

    let migrated = false;

    try {
        await loadSettings(options.database, options.settings);
        migrated = true;
    } catch {
        migrated = false;
    }

    requirements.push({
        name: "The database has had its migrations applied",
        met: migrated,
        remedy: "Run: pnpm db:migrate (add --remote for the deployed database)."
    });

    for (const seed of options.plan.buckets) {
        if (seed.kind !== "binding") {
            continue;
        }

        requirements.push({
            name: `The bucket "${seed.label}" is bound as ${seed.binding}`,
            met: seed.binding !== undefined && options.bindings[seed.binding] !== undefined,
            remedy: `Add an r2_buckets entry binding ${seed.binding} to ${seed.bucketName ?? "your bucket"} in wrangler.jsonc.`
        });
    }

    requirements.push({
        name: "A signing secret is configured",
        met: (options.authSecret?.length ?? 0) >= 32,
        remedy: "Set BETTER_AUTH_SECRET to at least 32 characters. Generate one with: openssl rand -base64 32"
    });

    requirements.push({
        name: "The address this site is served from is known",
        met: Boolean(options.authUrl),
        remedy: "Set BETTER_AUTH_URL to the address readers use, such as https://example.com."
    });

    return requirements;
}

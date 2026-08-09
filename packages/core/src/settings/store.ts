import { inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { setting } from "../db/schema/settings";
import {
    checkSettingValue,
    readSettingValue,
    type SettingCatalogue,
    type SettingValue,
    type SettingValues
} from "./definitions";

export interface Settings<TCatalogue extends SettingCatalogue> {
    get<TKey extends keyof TCatalogue>(key: TKey): SettingValue<TCatalogue[TKey]>;
    all(): SettingValues<TCatalogue>;
}

function resolve<TCatalogue extends SettingCatalogue>(
    catalogue: TCatalogue,
    stored: Map<string, unknown>
): SettingValues<TCatalogue> {
    const values = {} as Record<string, unknown>;

    for (const [key, declaration] of Object.entries(catalogue)) {
        // A value that no longer fits its declaration is ignored rather than served:
        // the setting's own default is always something the code can work with.
        const held = stored.has(key) ? readSettingValue(declaration, stored.get(key)) : undefined;

        values[key] = held ?? declaration.default;
    }

    return values as SettingValues<TCatalogue>;
}

export async function loadSettings<TCatalogue extends SettingCatalogue>(
    database: Database,
    catalogue: TCatalogue
): Promise<Settings<TCatalogue>> {
    const keys = Object.keys(catalogue);
    const rows = keys.length === 0 ? [] : await database.select().from(setting).where(inArray(setting.key, keys));

    const stored = new Map<string, unknown>();

    for (const row of rows) {
        try {
            stored.set(row.key, JSON.parse(row.value));
        } catch {
            // A row that is not JSON is treated as absent; the default stands in.
        }
    }

    const values = resolve(catalogue, stored);

    return { get: key => values[key], all: () => values };
}

export async function writeSettings<TCatalogue extends SettingCatalogue>(
    database: Database,
    catalogue: TCatalogue,
    changes: Partial<SettingValues<TCatalogue>>
): Promise<void> {
    const rows = [];

    for (const [key, value] of Object.entries(changes)) {
        const declaration = catalogue[key];

        if (declaration === undefined) {
            throw new Error(`Setting "${key}" is not declared, so nothing would read it.`);
        }

        if (readSettingValue(declaration, value) === undefined) {
            throw new Error(`Setting "${key}": ${JSON.stringify(value)} is not a value it accepts.`);
        }

        const problem = checkSettingValue(declaration, value);

        if (problem !== undefined) {
            throw new Error(`Setting "${key}": ${problem}`);
        }

        rows.push({ key, value: JSON.stringify(value), updatedAt: new Date() });
    }

    if (rows.length === 0) {
        return;
    }

    await database
        .insert(setting)
        .values(rows)
        .onConflictDoUpdate({
            target: setting.key,
            // Each row keeps its own value; without EXCLUDED they would all take the last one's.
            set: { value: sql`excluded.value`, updatedAt: new Date() }
        });

    forgetCachedSettings();
}

/** How long a worker may reuse settings before reading them again. */
export const SETTINGS_CACHE_TTL_MS = 30_000;

let cached: { values: unknown; expiresAt: number } | undefined;

/**
 * Settings are read on nearly every rendered page, and the database serves queries
 * one at a time, so they are held briefly in memory. An edit therefore reaches
 * other worker instances within the cache lifetime rather than instantly.
 */
export async function getSettings<TCatalogue extends SettingCatalogue>(
    database: Database,
    catalogue: TCatalogue,
    now: number = Date.now()
): Promise<Settings<TCatalogue>> {
    if (cached && cached.expiresAt > now) {
        return cached.values as Settings<TCatalogue>;
    }

    const settings = await loadSettings(database, catalogue);

    cached = { values: settings, expiresAt: now + SETTINGS_CACHE_TTL_MS };

    return settings;
}

/** Call after writing so the current worker stops serving the old values. */
export function forgetCachedSettings(): void {
    cached = undefined;
}

import { permalinkSettings } from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";
import {
    checkSettingValue,
    coreSettings,
    forgetCachedSettings,
    loadSettings,
    mergeSettings,
    readSettingValue,
    type SettingCatalogue,
    type SettingValues
} from "@jamcaa/core/settings";
import { post } from "./collections";
import { compareAndIncrementPublicAddressRevision, publicAddressRevision } from "./public-address-revision";
import { publicPostAddresses } from "./public-addresses";
import { checkPublicPermalink } from "./public-paths";
import { contentModel } from "./schema";

const permalinks = permalinkSettings(contentModel.collections);
const postPermalink = permalinks[`permalink.${post.name}`]!;

const sitePermalinks = { ...permalinks, [`permalink.${post.name}`]: { ...postPermalink, check: checkPublicPermalink } };

export const siteSettings = mergeSettings(coreSettings, sitePermalinks);

export async function writeSiteSettings(
    database: Database,
    changes: Partial<SettingValues<typeof siteSettings>>
): Promise<void> {
    const nextPermalink = changes["permalink.post"];
    const catalogue = siteSettings as SettingCatalogue;
    const settingStatements: D1PreparedStatement[] = [];

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

        settingStatements.push(
            database.$client
                .prepare(
                    "INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?) "
                        + "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
                )
                .bind(key, JSON.stringify(value), Date.now())
        );
    }

    if (settingStatements.length === 0) {
        return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const before = await loadSettings(database, siteSettings);
        const beforePermalink = before.get("permalink.post");
        const touchesAddress = typeof nextPermalink === "string";
        const changesAddress = touchesAddress && nextPermalink !== beforePermalink;
        const revision = touchesAddress ? await publicAddressRevision(database) : undefined;
        const addressStatements =
            changesAddress ?
                await publicPostAddresses(database).permalinkChangeStatements(beforePermalink, nextPermalink)
            :   [];
        const revisionStatements =
            revision === undefined ? [] : compareAndIncrementPublicAddressRevision(database, revision);

        try {
            await database.$client.batch([...addressStatements, ...settingStatements, ...revisionStatements]);
            forgetCachedSettings();
            return;
        } catch (error) {
            if (revision === undefined || (await publicAddressRevision(database)) === revision || attempt === 2) {
                throw error;
            }
        }
    }
}

"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { type SettingCatalogue } from "@jamcaaxian/core/settings";
import { adminMessages } from "@/content/admin-locale";
import { siteSettings, writeSiteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type SettingsFormState = { error?: string; saved?: boolean };

export async function saveSettings(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "manage"))) {
        return { error: copy.settings.permissionManage };
    }

    const changes: Record<string, string | boolean | number> = {};

    for (const [key, declaration] of Object.entries(siteSettings as SettingCatalogue)) {
        if (declaration.internal === true) {
            continue;
        }

        const raw = formData.get(key);

        switch (declaration.kind) {
            case "flag":
                // An unticked checkbox sends nothing at all.
                changes[key] = raw !== null;
                break;
            case "number": {
                const value = Number(raw);

                if (!Number.isFinite(value)) {
                    const localized = copy.settings.fields[key as keyof typeof copy.settings.fields];
                    return { error: copy.settings.numberRequired(localized?.label ?? declaration.label) };
                }

                changes[key] = value;
                break;
            }
            default:
                changes[key] = String(raw ?? "");
        }
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);

    try {
        await writeSiteSettings(database, changes);
    } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (/upload limit/i.test(message)) {
            return { error: copy.settings.errors.uploadLimit };
        }

        const key = Object.keys(changes).find(candidate => message.includes(`Setting "${candidate}"`));
        const localized = key ? copy.settings.fields[key as keyof typeof copy.settings.fields] : undefined;

        return { error: key ? copy.settings.errors.invalidSetting(localized?.label ?? key) : copy.settings.saveFailed };
    }

    revalidatePath("/", "layout");

    return { saved: true };
}

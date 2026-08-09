"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { writeSettings } from "@jamcaa/core/settings";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type SettingsFormState = { error?: string; saved?: boolean };

export async function saveSettings(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "manage"))) {
        return { error: "You do not have permission to change settings." };
    }

    const changes: Record<string, string | boolean | number> = {};

    for (const [key, declaration] of Object.entries(siteSettings)) {
        const raw = formData.get(key);

        switch (declaration.kind) {
            case "flag":
                // An unticked checkbox sends nothing at all.
                changes[key] = raw !== null;
                break;
            case "number": {
                const value = Number(raw);

                if (!Number.isFinite(value)) {
                    return { error: `${declaration.label} needs to be a number.` };
                }

                changes[key] = value;
                break;
            }
            default:
                changes[key] = String(raw ?? "");
        }
    }

    const { env } = getCloudflareContext();

    try {
        await writeSettings(createDatabase(env.DB), siteSettings, changes);
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Those settings could not be saved." };
    }

    revalidatePath("/admin/settings");

    return { saved: true };
}

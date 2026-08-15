"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { adminMessages } from "@/content/admin-locale";
import { writeSiteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type AccentFormState = { error?: string; saved?: boolean };

export async function saveAccent(_previous: AccentFormState, formData: FormData): Promise<AccentFormState> {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "manage"))) {
        return { error: copy.design.permissionManage };
    }

    const accent = String(formData.get("theme.accent") ?? "");

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);

    try {
        await writeSiteSettings(database, { "theme.accent": accent });
    } catch (error) {
        return {
            error:
                error instanceof Error && /colour/i.test(error.message) ? copy.design.invalid : copy.design.saveFailed
        };
    }

    revalidatePath("/", "layout");

    return { saved: true };
}

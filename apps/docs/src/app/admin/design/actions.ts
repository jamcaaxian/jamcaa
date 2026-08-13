"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { writeSiteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type AccentFormState = { error?: string; saved?: boolean };

export async function saveAccent(_previous: AccentFormState, formData: FormData): Promise<AccentFormState> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "manage"))) {
        return { error: "You do not have permission to change the design." };
    }

    const accent = String(formData.get("theme.accent") ?? "");

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);

    try {
        await writeSiteSettings(database, { "theme.accent": accent });
    } catch (error) {
        return { error: error instanceof Error ? error.message : "That accent could not be saved." };
    }

    revalidatePath("/", "layout");

    return { saved: true };
}

"use server";

import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { claimFirstAdministrator } from "@jamcaaxian/core/auth";
import { ensureInstalled } from "@jamcaaxian/core/install";
import { coreSettings, writeSettings } from "@jamcaaxian/core/settings";
import { installPlan } from "@/content/install";
import { getAuth } from "@/lib/auth";

export type SetupState = { error?: string };

export async function createFirstAdministrator(_previous: SetupState, formData: FormData): Promise<SetupState> {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const siteTitle = String(formData.get("siteTitle") ?? "").trim();

    if (!name || !email || !password || !siteTitle) {
        return { error: "Fill in every field to finish setting the site up." };
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const result = await claimFirstAdministrator({ auth: await getAuth(), database, name, email, password });

    if (result.status === "already-installed") {
        // Checked again here rather than only on the page, so the window between
        // loading the form and submitting it cannot be used to seize an account.
        redirect("/login");
    }

    if (result.status === "rejected") {
        return { error: result.message };
    }

    await ensureInstalled(database, installPlan);
    await writeSettings(database, coreSettings, { "site.title": siteTitle });

    redirect("/login");
}

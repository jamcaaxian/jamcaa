"use server";

import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { claimFirstAdministrator } from "@jamcaa/core/auth";
import { getAuth } from "@/lib/auth";

export type SetupState = { error?: string };

export async function createFirstAdministrator(
    _previous: SetupState,
    formData: FormData
): Promise<SetupState> {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!name || !email || !password) {
        return { error: "Fill in every field to create the first account." };
    }

    const { env } = getCloudflareContext();
    const result = await claimFirstAdministrator({
        auth: await getAuth(),
        database: createDatabase(env.DB),
        name,
        email,
        password
    });

    if (result.status === "already-installed") {
        // Checked again here rather than only on the page, so the window between
        // loading the form and submitting it cannot be used to seize an account.
        redirect("/login");
    }

    if (result.status === "rejected") {
        return { error: result.message };
    }

    redirect("/login");
}

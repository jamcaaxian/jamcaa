"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { replaceSystemRoleGrants, RoleGrantError, type CapabilityGrants } from "@jamcaaxian/core/auth";
import { siteCapabilities } from "@/content/install";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type RoleGrantsFormState = { error?: string; saved?: boolean };

export async function saveRoleGrants(_previous: RoleGrantsFormState, formData: FormData): Promise<RoleGrantsFormState> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "role", "manage"))) {
        return { error: "You do not have permission to change Role capabilities." };
    }

    const roleName = String(formData.get("roleName") ?? "");
    const grants: CapabilityGrants = {};

    for (const [key, value] of formData.entries()) {
        if (!key.startsWith("grant.")) {
            continue;
        }

        const resource = key.slice("grant.".length);
        (grants[resource] ??= []).push(String(value));
    }

    const { env } = getCloudflareContext();

    try {
        await replaceSystemRoleGrants(createDatabase(env.DB), siteCapabilities, roleName, grants);
    } catch (error) {
        return {
            error: error instanceof RoleGrantError ? error.message : "Those Role capabilities could not be saved."
        };
    }

    revalidatePath("/admin/roles");
    return { saved: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { replaceSystemRoleGrants, RoleGrantError, type CapabilityGrants } from "@jamcaaxian/core/auth";
import { adminMessages } from "@/content/admin-locale";
import { siteCapabilities } from "@/content/install";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type RoleGrantsFormState = { error?: string; saved?: boolean };

export async function saveRoleGrants(_previous: RoleGrantsFormState, formData: FormData): Promise<RoleGrantsFormState> {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "role", "manage"))) {
        return { error: copy.roles.permissionManage };
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
        return { error: error instanceof RoleGrantError ? copy.roles.saveFailed : copy.roles.saveFailed };
    }

    revalidatePath("/admin/roles");
    return { saved: true };
}

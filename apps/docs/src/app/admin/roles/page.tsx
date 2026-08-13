import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { inspectSystemRoleGrants } from "@jamcaaxian/core/auth";
import { siteCapabilities } from "@/content/install";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { RoleGrantsForm } from "./role-grants-form";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "role", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to see Role capabilities.</p>;
    }

    const { env } = getCloudflareContext();
    const model = await inspectSystemRoleGrants(createDatabase(env.DB), siteCapabilities);

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold tracking-tight">Roles</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                Choose what each system Role may do. Capability changes apply to every user holding that Role.
            </p>
            <RoleGrantsForm model={model} mayManage={await may(actor, "role", "manage")} />
        </div>
    );
}

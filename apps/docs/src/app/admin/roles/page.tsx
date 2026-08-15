import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { inspectSystemRoleGrants } from "@jamcaaxian/core/auth";
import { adminMessages } from "@/content/admin-locale";
import { siteCapabilities } from "@/content/install";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { RoleGrantsForm } from "./role-grants-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.roles.title };
}

export default async function RolesPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "role", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.roles.permission}</p>;
    }

    const { env } = getCloudflareContext();
    const model = await inspectSystemRoleGrants(createDatabase(env.DB), siteCapabilities);

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold tracking-tight">{copy.roles.title}</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">{copy.roles.description}</p>
            <RoleGrantsForm model={model} mayManage={await may(actor, "role", "manage")} />
        </div>
    );
}

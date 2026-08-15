import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { getSettings } from "@jamcaaxian/core/settings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { adminMessages } from "@/content/admin-locale";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { AccentForm } from "./accent-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.design.title };
}

export default async function DesignPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.design.permission}</p>;
    }

    const { env } = getCloudflareContext();
    const settings = await getSettings(createDatabase(env.DB), siteSettings);
    const accent = settings.get("theme.accent");

    return (
        <div className="space-y-8">
            <AdminPageHeader title={copy.design.title} description={copy.design.description} />
            <AccentForm current={accent} />
        </div>
    );
}

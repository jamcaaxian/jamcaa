import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { getSettings } from "@jamcaaxian/core/settings";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { AccentForm } from "./accent-form";

export const metadata: Metadata = { title: "Design" };

export default async function DesignPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to see the design.</p>;
    }

    const { env } = getCloudflareContext();
    const settings = await getSettings(createDatabase(env.DB), siteSettings);

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Design"
                description="The accent colours every interactive surface. More of the theme becomes adjustable as the design system grows."
            />
            <AccentForm current={settings.get("theme.accent")} />
        </div>
    );
}

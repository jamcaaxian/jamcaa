import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { loadSettings } from "@jamcaa/core/settings";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { SettingsForm, type SettingField } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to see settings.</p>;
    }

    const { env } = getCloudflareContext();
    const settings = await loadSettings(createDatabase(env.DB), siteSettings);
    const values = settings.all();

    // Only what can cross to the browser: the catalogue itself holds functions.
    const fields: SettingField[] = Object.entries(siteSettings).map(([key, declaration]) => ({
        key,
        kind: declaration.kind,
        label: declaration.label,
        description: declaration.description,
        multiline: declaration.kind === "text" ? declaration.multiline : undefined,
        preview: declaration.kind === "text" ? declaration.preview : undefined,
        suggestions: declaration.kind === "text" ? declaration.suggestions : undefined,
        of: declaration.kind === "choice" ? declaration.of : undefined,
        value: values[key] as string | boolean | number
    }));

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            <SettingsForm fields={fields} mayManage={await may(actor, "settings", "manage")} />
        </div>
    );
}

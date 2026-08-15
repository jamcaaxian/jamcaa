import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { loadSettings, type SettingCatalogue } from "@jamcaaxian/core/settings";
import { adminMessages } from "@/content/admin-locale";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { SettingsForm, type SettingField } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.settings.title };
}

export default async function SettingsPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.settings.permission}</p>;
    }

    const { env } = getCloudflareContext();
    const settings = await loadSettings(createDatabase(env.DB), siteSettings);
    const values = settings.all() as Record<string, string | boolean | number>;

    // Only what can cross to the browser: the catalogue itself holds functions.
    // Internal settings are the platform's bookkeeping and are not offered for editing.
    const fields: SettingField[] = Object.entries(siteSettings as SettingCatalogue)
        .filter(([, declaration]) => declaration.internal !== true)
        .map(([key, declaration]) => {
            const localized = copy.settings.fields[key as keyof typeof copy.settings.fields];
            const description =
                localized !== undefined && "description" in localized ? localized.description : declaration.description;

            return {
                key,
                kind: declaration.kind,
                label: localized?.label ?? declaration.label,
                description,
                multiline: declaration.kind === "text" ? declaration.multiline : undefined,
                preview: declaration.kind === "text" ? declaration.preview : undefined,
                suggestions: declaration.kind === "text" ? declaration.suggestions : undefined,
                of: declaration.kind === "choice" ? declaration.of : undefined,
                value: values[key]!
            };
        });

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold tracking-tight">{copy.settings.title}</h1>
            <SettingsForm fields={fields} mayManage={await may(actor, "settings", "manage")} />
        </div>
    );
}

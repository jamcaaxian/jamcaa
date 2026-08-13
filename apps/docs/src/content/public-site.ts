import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { formatMoment } from "@jamcaaxian/core/dates";
import { loadSettings, type SettingCatalogue } from "@jamcaaxian/core/settings";
import { publicPostAddresses, type FormerPostResolution } from "./public-addresses";
import { postAddress, resolvePublishedPost } from "./public-paths";
import { siteSettings } from "./settings";
import { posts } from "./store";

function database() {
    return createDatabase(getCloudflareContext().env.DB);
}

function declaredDefault(catalogue: SettingCatalogue, key: string): string {
    const value = catalogue[key]?.default;

    return typeof value === "string" ? value : "";
}

function isMissingSettingsTable(error: unknown): boolean {
    return error instanceof Error && /no such table:\s*setting/i.test(error.message);
}

export async function publicSiteSettings() {
    return loadSettings(database(), siteSettings);
}

export async function publicSiteMetadata(): Promise<Metadata> {
    let title = declaredDefault(siteSettings, "site.title");
    let description = declaredDefault(siteSettings, "site.description").trim() || undefined;

    try {
        const settings = await publicSiteSettings();

        title = settings.get("site.title");
        description = settings.get("site.description").trim() || undefined;
    } catch (error) {
        if (!isMissingSettingsTable(error)) {
            throw error;
        }
    }

    return {
        title: { default: title, template: `%s | ${title}` },
        description,
        applicationName: title,
        openGraph: { title, description, siteName: title, type: "website" }
    };
}

export async function publicPostAddress(entry: {
    slug: string;
    publishedAt: Date | null;
    createdAt: Date;
}): Promise<string> {
    const settings = await publicSiteSettings();

    return postAddress(settings.get("permalink.post"), entry);
}

export async function publishedPostAt(pathSegments: string[]) {
    const settings = await publicSiteSettings();
    const siteDatabase = database();
    const store = posts(siteDatabase);
    const pattern = settings.get("permalink.post");
    const entry = await resolvePublishedPost({ pattern, pathSegments, bySlug: slug => store.bySlug(slug) });

    if (entry !== undefined) {
        return { kind: "entry" as const, entry };
    }

    const former: FormerPostResolution | undefined = await publicPostAddresses(siteDatabase).formerAt(
        pathSegments,
        pattern
    );

    return former === undefined ? undefined : { kind: "former" as const, ...former };
}

export async function publicMoment(moment: Date): Promise<{ dateTime: string; label: string }> {
    const settings = await publicSiteSettings();
    const date = formatMoment(moment, settings.get("format.date"));
    const time = formatMoment(moment, settings.get("format.time"));

    return { dateTime: moment.toISOString(), label: `${date} ${time}` };
}

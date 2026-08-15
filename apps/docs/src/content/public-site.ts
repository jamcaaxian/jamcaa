import type { Metadata } from "next";
import type { EntryOf } from "@jamcaaxian/core/content";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { formatMoment } from "@jamcaaxian/core/dates";
import { loadSettings, type SettingCatalogue } from "@jamcaaxian/core/settings";
import { publicPostAddresses, type FormerPostResolution } from "./public-addresses";
import { postAddress, resolvePublishedPost } from "./public-paths";
import { pages } from "./pages-store";
import { docsLocales, localizedPath, type DocsLocale, type LocaleAddresses } from "./locales";
import { siteSettings } from "./settings";
import { posts } from "./store";
import { post } from "./collections";

type PublicPostEntry = EntryOf<typeof post>;

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
    const { env } = getCloudflareContext();
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
        metadataBase: new URL(env.BETTER_AUTH_URL),
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

export async function publicPostTranslation(entry: PublicPostEntry, locale: DocsLocale) {
    if (!entry.translationId) {
        return undefined;
    }

    const variants = await posts(database()).translations(entry.translationId);

    return variants.find(candidate => candidate.locale === locale && candidate.status === "published");
}

export async function publicPostLocaleAddresses(
    entry: PublicPostEntry,
    siteDatabase = database()
): Promise<LocaleAddresses> {
    const variants = entry.translationId ? await posts(siteDatabase).translations(entry.translationId) : [entry];
    const settings = await loadSettings(siteDatabase, siteSettings);
    const pattern = settings.get("permalink.post");
    const addresses: LocaleAddresses = {};

    for (const variant of variants) {
        const locale = docsLocales.canonical(variant.locale);

        if (locale !== undefined && variant.status === "published") {
            addresses[locale] = localizedPath(locale, postAddress(pattern, variant));
        }
    }

    return addresses;
}

export async function publicPageLocaleAddresses(
    page: { translationId: string },
    siteDatabase = database()
): Promise<LocaleAddresses> {
    const variants = await pages(siteDatabase).translations(page.translationId);
    const addresses: LocaleAddresses = {};

    for (const variant of variants) {
        const locale = docsLocales.canonical(variant.locale);

        if (locale !== undefined && variant.status === "published") {
            addresses[locale] = localizedPath(locale, variant.address);
        }
    }

    return addresses;
}

export async function publishedPostAt(pathSegments: string[], locale: DocsLocale = docsLocales.defaultLocale) {
    const settings = await publicSiteSettings();
    const siteDatabase = database();
    const store = posts(siteDatabase);
    const pattern = settings.get("permalink.post");
    const entry = await resolvePublishedPost({ pattern, pathSegments, bySlug: slug => store.bySlug(slug, locale) });

    if (entry !== undefined) {
        return { kind: "entry" as const, entry };
    }

    const former: FormerPostResolution | undefined = await publicPostAddresses(siteDatabase).formerAt(
        pathSegments,
        pattern,
        locale
    );

    return former === undefined ? undefined : { kind: "former" as const, ...former };
}

/** A published Page at the given path, when one exists. */
export async function publicPageAt(pathSegments: string[], locale: DocsLocale = docsLocales.defaultLocale) {
    return pages(database()).byAddress(`/${pathSegments.join("/")}`, locale);
}

export async function publicMoment(
    moment: Date,
    locale: DocsLocale = docsLocales.defaultLocale
): Promise<{ dateTime: string; label: string }> {
    const settings = await publicSiteSettings();
    const date = formatMoment(moment, settings.get("format.date"), locale);
    const time = formatMoment(moment, settings.get("format.time"), locale);

    return { dateTime: moment.toISOString(), label: `${date} ${time}` };
}

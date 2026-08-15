import { defineLocaleCatalogue } from "@jamcaaxian/core/i18n";

export const docsLocales = defineLocaleCatalogue({
    defaultLocale: "en-US",
    locales: [
        { tag: "en-US", urlKey: "en-us", label: "English", matches: ["en"] },
        { tag: "zh-Hans-CN", urlKey: "zh-hans-cn", label: "简体中文", matches: ["zh", "zh-CN", "zh-Hans"] }
    ]
} as const);

export type DocsLocale = (typeof docsLocales.locales)[number];
export type DocsLocaleKey = (typeof docsLocales.definitions)[number]["urlKey"];

export interface DocsLocaleContext {
    locale: DocsLocale;
    localeKey: DocsLocaleKey;
}

export type LocaleAddresses = Partial<Record<DocsLocale, string>>;

/** Resolves one public URL segment into the registered Docs Locale identity. */
export function docsLocaleContext(value: string): DocsLocaleContext | undefined {
    const locale = docsLocales.fromUrlKey(value);

    if (locale === undefined) {
        return undefined;
    }

    return { locale, localeKey: docsLocales.urlKey(locale) };
}

/** Adds a Locale prefix to a Site-owned public path. */
export function localizedPath(locale: DocsLocale, path = "/"): string {
    const prefix = `/${docsLocales.urlKey(locale)}`;

    if (path === "/" || path === "") {
        return prefix;
    }

    return `${prefix}/${path.replace(/^\/+/, "")}`;
}

/** Produces catalogue-driven hreflang addresses for one Site-owned path. */
export function localeAlternates(path = "/", includeDefault = false): Record<string, string> {
    const languages = Object.fromEntries(
        docsLocales.definitions.map(definition => [definition.tag, localizedPath(definition.tag, path)])
    );

    if (includeDefault) {
        languages["x-default"] = "/";
    }

    return languages;
}

/** Removes a registered Locale prefix while retaining a leading slash. */
export function unlocalizedPath(path: string): string {
    const segments = path.replace(/^\/+/, "").split("/");

    if (segments[0] !== undefined && docsLocales.fromUrlKey(segments[0]) !== undefined) {
        segments.shift();
    }

    return `/${segments.join("/")}`;
}

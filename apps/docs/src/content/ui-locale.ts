import { docsLocales, type DocsLocale } from "./locales";

export const UI_LOCALE_COOKIE = "jamcaa-ui-locale";

export interface UiLocaleInput {
    routedLocale?: string;
    cookieLocale?: string;
    acceptLanguage?: string | null;
}

/** Public URL identity wins; application UI then follows an explicit preference or browser negotiation. */
export function resolveUiLocale(input: UiLocaleInput): DocsLocale {
    return (
        (input.routedLocale ? docsLocales.canonical(input.routedLocale) : undefined)
        ?? (input.cookieLocale ? docsLocales.canonical(input.cookieLocale) : undefined)
        ?? docsLocales.negotiate(input.acceptLanguage)
        ?? docsLocales.defaultLocale
    );
}

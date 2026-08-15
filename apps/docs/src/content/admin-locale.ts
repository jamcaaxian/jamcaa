import { cookies, headers } from "next/headers";
import { adminCopy } from "./admin-copy";
import { docsLocales } from "./locales";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "./ui-locale";

export async function adminLocale() {
    try {
        const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);

        return resolveUiLocale({
            cookieLocale: cookieStore.get(UI_LOCALE_COOKIE)?.value,
            acceptLanguage: requestHeaders.get("accept-language")
        });
    } catch {
        // Unit tests and pre-render inspection may call a module without a request scope.
        return docsLocales.defaultLocale;
    }
}

export async function adminMessages() {
    const locale = await adminLocale();

    return { locale, copy: adminCopy(locale) };
}

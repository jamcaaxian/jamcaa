import { describe, expect, it } from "vitest";
import { docsLocales, localeAlternates, localizedPath } from "@/content/locales";
import { resolveUiLocale } from "@/content/ui-locale";

describe("interface Locale resolution", () => {
    it("keeps a public URL Locale authoritative", () => {
        expect(resolveUiLocale({ routedLocale: "zh-Hans-CN", cookieLocale: "en-US", acceptLanguage: "en" })).toBe(
            "zh-Hans-CN"
        );
    });

    it("uses an explicit interface preference for application routes", () => {
        expect(resolveUiLocale({ cookieLocale: "zh-hans-cn", acceptLanguage: "en" })).toBe("zh-Hans-CN");
    });

    it("negotiates the browser language and then falls back", () => {
        expect(resolveUiLocale({ acceptLanguage: "zh-CN, en;q=0.8" })).toBe("zh-Hans-CN");
        expect(resolveUiLocale({ cookieLocale: "not-a-locale", acceptLanguage: "fr" })).toBe("en-US");
    });

    it("derives alternate addresses from every registered Locale", () => {
        expect(localeAlternates("/guides", true)).toEqual({
            ...Object.fromEntries(
                docsLocales.definitions.map(definition => [definition.tag, localizedPath(definition.tag, "/guides")])
            ),
            "x-default": "/"
        });
    });
});

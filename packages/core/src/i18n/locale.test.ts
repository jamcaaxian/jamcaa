import { describe, expect, it } from "vitest";
import { canonicalLocale, defineLocaleCatalogue } from "./locale";

const locales = defineLocaleCatalogue({
    defaultLocale: "en-US",
    locales: [
        { tag: "en-US", urlKey: "en-us", label: "English (United States)", matches: ["en", "en-GB"] },
        { tag: "zh-Hans-CN", urlKey: "zh-hans-cn", label: "简体中文（中国大陆）", matches: ["zh", "zh-CN", "zh-Hans"] }
    ] as const
});

describe("BCP 47 Locales", () => {
    it("canonicalises valid language tags and compatibility underscores", () => {
        expect(canonicalLocale(" zh_hans_cn ")).toBe("zh-Hans-CN");
        expect(canonicalLocale("EN-us")).toBe("en-US");
    });

    it("rejects malformed language tags", () => {
        expect(() => canonicalLocale("en--US")).toThrow("not a well-formed BCP 47");
    });

    it("maps canonical tags and stable URL keys", () => {
        expect(locales.canonical("ZH-hans-cn")).toBe("zh-Hans-CN");
        expect(locales.fromUrlKey("ZH-HANS-CN")).toBe("zh-Hans-CN");
        expect(locales.urlKey("en-US")).toBe("en-us");
    });

    it("negotiates explicit product ranges in quality order", () => {
        expect(locales.negotiate("fr-FR, zh-CN;q=0.9, en-US;q=0.8")).toBe("zh-Hans-CN");
        expect(locales.negotiate("en-GB, en;q=0.8")).toBe("en-US");
        expect(locales.negotiate("zh-Hant, fr-FR;q=0.8")).toBeUndefined();
    });
});

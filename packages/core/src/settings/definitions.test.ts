import { describe, expect, expectTypeOf, it } from "vitest";
import {
    checkSettingValue,
    coreSettings,
    defineSettings,
    mergeSettings,
    readSettingValue,
    type SettingValues
} from "./definitions";

describe("defineSettings", () => {
    it("insists on a namespace", () => {
        expect(() => defineSettings({ title: { kind: "text", label: "Title", default: "" } })).toThrow(/namespaced/);
    });

    it("lets a key be named after a collection", () => {
        // Collection names are table names, so they are snake case.
        expect(() =>
            defineSettings({ "permalink.blog_post": { kind: "text", label: "Address", default: "/{slug}" } })
        ).not.toThrow();
    });

    it("refuses a default the setting would reject", () => {
        expect(() =>
            defineSettings({
                "post.order": { kind: "choice", label: "Order", of: ["newest", "oldest"], default: "random" }
            })
        ).toThrow(/not one of the choices/);
    });

    it("ships defaults its own settings would accept", () => {
        // A default that fails its own check leaves a fresh install broken.
        for (const [key, declaration] of Object.entries(coreSettings)) {
            expect(readSettingValue(declaration, declaration.default), key).toBeDefined();
            expect(checkSettingValue(declaration, declaration.default), key).toBeUndefined();
        }
    });
});

describe("mergeSettings", () => {
    it("refuses two settings with one key", () => {
        const one = defineSettings({ "site.title": { kind: "text", label: "A", default: "" } });

        expect(() => mergeSettings(one, one)).toThrow(/both named "site.title"/);
    });

    it("brings separate catalogues together", () => {
        const platform = defineSettings({ "site.title": { kind: "text", label: "A", default: "" } });
        const plugin = defineSettings({ "shop.currency": { kind: "text", label: "B", default: "GBP" } });

        expect(Object.keys(mergeSettings(platform, plugin))).toEqual(["site.title", "shop.currency"]);
    });
});

describe("readSettingValue", () => {
    it("keeps a value of the right shape", () => {
        expect(readSettingValue({ kind: "text", label: "x", default: "" }, "hello")).toBe("hello");
        expect(readSettingValue({ kind: "flag", label: "x", default: false }, true)).toBe(true);
        expect(readSettingValue({ kind: "number", label: "x", default: 0 }, 42)).toBe(42);
    });

    it("rejects a value of the wrong shape", () => {
        // A stored value can outlive the declaration that accepted it.
        expect(readSettingValue({ kind: "text", label: "x", default: "" }, 42)).toBeUndefined();
        expect(readSettingValue({ kind: "flag", label: "x", default: false }, "true")).toBeUndefined();
        expect(readSettingValue({ kind: "number", label: "x", default: 0 }, Number.NaN)).toBeUndefined();
    });

    it("rejects a choice nobody offered", () => {
        const declaration = { kind: "choice", label: "x", of: ["a", "b"], default: "a" } as const;

        expect(readSettingValue(declaration, "b")).toBe("b");
        expect(readSettingValue(declaration, "c")).toBeUndefined();
    });
});

describe("the types a catalogue produces", () => {
    const catalogue = defineSettings({
        "site.title": { kind: "text", label: "Title", default: "" },
        "site.public": { kind: "flag", label: "Public", default: true },
        "post.perPage": { kind: "number", label: "Per page", default: 10 },
        "post.order": { kind: "choice", label: "Order", of: ["newest", "oldest"], default: "newest" }
    });

    type Values = SettingValues<typeof catalogue>;

    it("keeps every setting it was given", () => {
        expect(Object.keys(catalogue)).toEqual(["site.title", "site.public", "post.perPage", "post.order"]);
    });

    it("gives each setting the type its kind implies", () => {
        expectTypeOf<Values["site.title"]>().toEqualTypeOf<string>();
        expectTypeOf<Values["site.public"]>().toEqualTypeOf<boolean>();
        expectTypeOf<Values["post.perPage"]>().toEqualTypeOf<number>();
    });

    it("narrows a choice to what it offers", () => {
        expectTypeOf<Values["post.order"]>().toEqualTypeOf<"newest" | "oldest">();
    });
});

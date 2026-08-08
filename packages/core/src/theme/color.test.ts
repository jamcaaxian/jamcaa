import { describe, expect, it } from "vitest";
import {
    adjustForContrast,
    contrastRatio,
    makeAccentUsable,
    parseColor,
    readableForegroundOn,
    shiftLightness
} from "./color";
import { DEFAULT_ACCENT, resolveTheme, themeToCss } from "./tokens";

describe("parseColor", () => {
    const equivalents = ["#3388FF", "#38f", "rgb(51, 136, 255)", "rgba(51, 136, 255, 1)"];

    it("reads the formats a person is likely to paste", () => {
        for (const input of equivalents) {
            expect(parseColor(input)).toBeDefined();
        }
    });

    it("normalises equivalent notations to the same colour", () => {
        const [first, ...rest] = equivalents.map((input) => parseColor(input)!);

        for (const other of rest) {
            expect(other.l).toBeCloseTo(first!.l, 5);
            expect(other.c).toBeCloseTo(first!.c, 5);
        }
    });

    it("keeps alpha", () => {
        expect(parseColor("rgba(51, 136, 255, 0.5)")?.alpha).toBe(0.5);
    });

    it("tolerates surrounding whitespace", () => {
        expect(parseColor("  #3388FF  ")).toBeDefined();
    });

    it("reports failure rather than guessing", () => {
        expect(parseColor("not-a-colour")).toBeUndefined();
        expect(parseColor("")).toBeUndefined();
    });
});

describe("readableForegroundOn", () => {
    it("picks dark text on a light surface", () => {
        const result = readableForegroundOn("oklch(1 0 0)");

        expect(result.meetsTarget).toBe(true);
        expect(contrastRatio(result.color, "oklch(1 0 0)")).toBeGreaterThanOrEqual(4.5);
    });

    it("picks light text on a dark surface", () => {
        const result = readableForegroundOn("oklch(0.145 0 0)");

        expect(result.meetsTarget).toBe(true);
    });

    it("admits when neither option is legible", () => {
        // Around this lightness both directions land just under the bar; the
        // window is narrow, which is exactly why it needs a guard rather than luck.
        expect(readableForegroundOn("oklch(0.565 0 0)").meetsTarget).toBe(false);
    });
});

describe("makeAccentUsable", () => {
    it("keeps a dark accent as supplied", () => {
        const navy = parseColor("#00214d")!;
        const usable = makeAccentUsable(navy);

        expect(usable.darkenedBy).toBeUndefined();
        expect(usable.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("darkens the default accent so its label is legible", () => {
        const usable = makeAccentUsable(parseColor(DEFAULT_ACCENT)!);

        expect(usable.darkenedBy).toBeGreaterThan(0);
        expect(usable.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("always places light text on the accent", () => {
        // A mid blue scores higher with near-black text, but that reads as a
        // mistake. Convention wins and the accent moves instead.
        const usable = makeAccentUsable(parseColor(DEFAULT_ACCENT)!);

        expect(usable.foreground).toBe("oklch(0.985 0 0)");
    });

    it("keeps the hue recognisable while darkening", () => {
        const accent = parseColor(DEFAULT_ACCENT)!;
        const usable = parseColor(makeAccentUsable(accent).color)!;

        expect(usable.h).toBeCloseTo(accent.h!, 3);
        expect(usable.c).toBeCloseTo(accent.c, 3);
    });
});

describe("adjustForContrast", () => {
    it("leaves a colour alone when it already clears the bar", () => {
        const navy = parseColor("#00214d")!;

        expect(adjustForContrast(navy, "#ffffff", 4.5).l).toBeCloseTo(navy.l, 5);
    });

    it("darkens a colour that is too light against white", () => {
        const accent = parseColor(DEFAULT_ACCENT)!;
        const adjusted = adjustForContrast(accent, "#ffffff", 4.5);

        expect(adjusted.l).toBeLessThan(accent.l);
    });

    it("preserves hue while moving lightness", () => {
        const accent = parseColor(DEFAULT_ACCENT)!;
        const adjusted = adjustForContrast(accent, "#ffffff", 4.5);

        expect(adjusted.h).toBeCloseTo(accent.h!, 3);
    });
});

describe("shiftLightness", () => {
    it("stays inside the valid range", () => {
        const white = parseColor("#ffffff")!;

        expect(shiftLightness(white, 0.5).l).toBe(1);
        expect(shiftLightness(white, -2).l).toBe(0);
    });
});

describe("resolveTheme", () => {
    it("accepts an override in any supported notation", () => {
        const resolved = resolveTheme({ secondary: "rgb(51, 136, 255)" });

        expect(resolved.declarations.secondary).toMatch(/^oklch\(/);
        expect(resolved.rejected).toHaveLength(0);
    });

    it("derives the accent foreground rather than trusting a setting", () => {
        const resolved = resolveTheme({ primary: DEFAULT_ACCENT });

        expect(
            contrastRatio(resolved.declarations["primary-foreground"]!, resolved.declarations.primary!)
        ).toBeGreaterThanOrEqual(4.5);
    });

    it("says when it had to move the accent to keep the label legible", () => {
        const resolved = resolveTheme({ primary: DEFAULT_ACCENT });

        expect(resolved.adjustments.map((entry) => entry.token)).toContain("primary");
    });

    it("stays quiet when the accent needed no help", () => {
        const resolved = resolveTheme({ primary: "#00214d" });

        expect(resolved.adjustments).toHaveLength(0);
    });

    it("reports an unparseable value instead of dropping it", () => {
        const resolved = resolveTheme({ primary: "octarine" });

        expect(resolved.rejected).toEqual([{ token: "primary", value: "octarine" }]);
        expect(resolved.declarations.primary).toBeUndefined();
    });

    it("ignores tokens that are not open to configuration", () => {
        const resolved = resolveTheme({ "primary-foreground": "#ff0000" } as never);

        expect(resolved.declarations["primary-foreground"]).toBeUndefined();
    });
});

describe("themeToCss", () => {
    it("emits custom properties under the given selector", () => {
        const css = themeToCss(resolveTheme({ primary: DEFAULT_ACCENT }), ".dark");

        expect(css).toContain(".dark {");
        expect(css).toContain("--primary:");
    });

    it("emits nothing when there is nothing to override", () => {
        expect(themeToCss(resolveTheme({}))).toBe("");
    });
});

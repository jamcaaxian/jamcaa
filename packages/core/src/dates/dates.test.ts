import { describe, expect, it } from "vitest";
import { checkPattern, describePattern, formatMoment, DATE_PATTERNS, TIME_PATTERNS } from "./index";

const moment = new Date(Date.UTC(2026, 7, 9, 14, 5, 3));

describe("checkPattern", () => {
    it("accepts every pattern offered as a preset", () => {
        for (const pattern of [...DATE_PATTERNS, ...TIME_PATTERNS]) {
            expect(checkPattern(pattern)).toBeUndefined();
        }
    });

    it("says what to use instead of the tokens people reach for first", () => {
        // Coming from WordPress or Moment, YYYY-MM-DD is the obvious guess.
        expect(checkPattern("YYYY-MM-DD")).toMatch(/Use `yyyy` instead of `YYYY`/);
        expect(checkPattern("yyyy-MM-DD")).toMatch(/Use `dd` instead of `DD`/);
    });

    it("keeps the advice short enough to sit under a field", () => {
        const problem = checkPattern("YYYY-MM-DD") ?? "";

        expect(problem).not.toMatch(/https?:/);
        expect(problem).not.toMatch(/GMT/);
    });

    it("asks for something rather than nothing", () => {
        expect(checkPattern("   ")).toMatch(/Give a pattern/);
    });
});

describe("describePattern", () => {
    it("shows what the pattern would produce", () => {
        expect(describePattern("yyyy-MM-dd")).toBe("2026-08-09");
    });

    it("reads the same wherever it is shown", () => {
        // A UTC sample would tell someone in Shanghai a different time from
        // someone in London, for a value that is only meant to be an example.
        expect(describePattern("HH:mm")).toBe("14:05");
    });

    it("shows nothing when the pattern cannot be used", () => {
        expect(describePattern("YYYY")).toBeUndefined();
    });
});

describe("formatMoment", () => {
    it("formats by the pattern given", () => {
        expect(formatMoment(moment, "yyyy-MM-dd")).toBe("2026-08-09");
    });

    it("would rather look wrong than take the page down", () => {
        // The pattern arrives from configuration and is checked when it is saved,
        // but an older stored value could still be unusable.
        expect(formatMoment(moment, "YYYY-MM-DD")).toBe("2026-08-09");
    });
});

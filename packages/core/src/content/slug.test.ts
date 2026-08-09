import { describe, expect, it } from "vitest";
import { freeSlug, toSlug } from "./slug";

describe("toSlug", () => {
    it("joins words with hyphens", () => {
        expect(toSlug("Hello There World")).toBe("hello-there-world");
    });

    it("drops punctuation rather than encoding it", () => {
        expect(toSlug("What's new? (2026 edition)")).toBe("whats-new-2026-edition");
    });

    it("keeps a title that uses no Latin letters", () => {
        // Stripping to ASCII would leave nothing to name the entry by.
        expect(toSlug("你好，世界")).toBe("你好-世界");
        expect(toSlug("Привет мир")).toBe("привет-мир");
    });

    it("does not begin or end with a hyphen", () => {
        expect(toSlug("  ...draft...  ")).toBe("draft");
    });

    it("returns nothing when there was nothing to keep", () => {
        expect(toSlug("!!! ???")).toBe("");
    });
});

describe("freeSlug", () => {
    it("uses what was asked for when it is free", async () => {
        expect(await freeSlug("hello", async () => false)).toBe("hello");
    });

    it("counts up past the ones already taken", async () => {
        const taken = new Set(["hello", "hello-2", "hello-3"]);

        expect(await freeSlug("hello", async candidate => taken.has(candidate))).toBe("hello-4");
    });

    it("gives up rather than looping forever", async () => {
        await expect(freeSlug("hello", async () => true)).rejects.toThrow(/Could not find a free slug/);
    });
});

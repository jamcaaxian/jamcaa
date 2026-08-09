import { describe, expect, it } from "vitest";
import { chooseRule, parseConditions, ruleMatches, type StorageRule, type UploadContext } from "./rules";

function rule(partial: Partial<StorageRule> & Pick<StorageRule, "id" | "bucketId">): StorageRule {
    return { label: partial.id, priority: 0, isFallback: false, conditions: {}, ...partial };
}

const upload: UploadContext = {
    collection: "post",
    categories: ["engineering"],
    tags: ["cloudflare", "workers"],
    authorRole: "author",
    authorId: "author-1",
    mimeType: "image/png",
    size: 200_000,
    at: new Date("2026-08-09T00:00:00Z")
};

describe("ruleMatches", () => {
    it("matches everything when it asks for nothing", () => {
        expect(ruleMatches(rule({ id: "any", bucketId: "b" }), upload)).toBe(true);
    });

    it("treats an empty list as asking for nothing", () => {
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { tags: [] } }), upload)).toBe(true);
    });

    it("matches on the collection", () => {
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { collections: ["post"] } }), upload)).toBe(true);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { collections: ["guide"] } }), upload)).toBe(
            false
        );
    });

    it("matches when any tag is shared", () => {
        const conditions = { tags: ["workers", "unused"] };

        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions }), upload)).toBe(true);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { tags: ["none"] } }), upload)).toBe(false);
    });

    it("matches a type by its leading part", () => {
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { mimePrefixes: ["image/"] } }), upload)).toBe(
            true
        );
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { mimePrefixes: ["video/"] } }), upload)).toBe(
            false
        );
    });

    it("treats both size bounds as inclusive", () => {
        const exactly = { minSize: 200_000, maxSize: 200_000 };

        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: exactly }), upload)).toBe(true);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { minSize: 200_001 } }), upload)).toBe(false);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: { maxSize: 199_999 } }), upload)).toBe(false);
    });

    it("matches within a date range", () => {
        const inside = { from: "2026-01-01", until: "2026-12-31" };
        const after = { from: "2026-09-01" };

        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: inside }), upload)).toBe(true);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions: after }), upload)).toBe(false);
    });

    it("requires every condition it states, not merely one", () => {
        const conditions = { collections: ["post"], mimePrefixes: ["video/"] };

        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions }), upload)).toBe(false);
    });

    it("does not match an author it was not told about", () => {
        const conditions = { authorIds: ["author-1"] };

        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions }), upload)).toBe(true);
        expect(ruleMatches(rule({ id: "r", bucketId: "b", conditions }), { ...upload, authorId: undefined })).toBe(
            false
        );
    });
});

describe("chooseRule", () => {
    const fallback = rule({ id: "fallback", bucketId: "general", isFallback: true, priority: 99 });

    it("takes the first match by priority", () => {
        const chosen = chooseRule(
            [
                fallback,
                rule({ id: "late", bucketId: "b2", priority: 20, conditions: { mimePrefixes: ["image/"] } }),
                rule({ id: "early", bucketId: "b1", priority: 10, conditions: { mimePrefixes: ["image/"] } })
            ],
            upload
        );

        expect(chosen.id).toBe("early");
    });

    it("uses the fallback when nothing else claims the file", () => {
        const chosen = chooseRule(
            [fallback, rule({ id: "video", bucketId: "b1", conditions: { mimePrefixes: ["video/"] } })],
            upload
        );

        expect(chosen.id).toBe("fallback");
    });

    it("never lets the fallback outrank a rule that matches", () => {
        // Its priority is lower, but it is meant to catch what nothing else claimed.
        const eager = rule({ id: "eager", bucketId: "general", isFallback: true, priority: -100 });
        const chosen = chooseRule([eager, rule({ id: "images", bucketId: "b1", priority: 50 })], upload);

        expect(chosen.id).toBe("images");
    });

    it("says plainly when there is nothing to catch the file", () => {
        expect(() =>
            chooseRule([rule({ id: "video", bucketId: "b1", conditions: { mimePrefixes: ["video/"] } })], upload)
        ).toThrow(/no fallback rule/);
    });
});

describe("parseConditions", () => {
    it("reads what was stored", () => {
        expect(parseConditions('{"tags":["a"]}')).toEqual({ tags: ["a"] });
    });

    it("gives up on anything it cannot read", () => {
        // Leaving the rule out is safer than letting it stand for "match everything".
        expect(parseConditions("not json")).toBeUndefined();
        expect(parseConditions("[]")).toBeUndefined();
        expect(parseConditions("null")).toBeUndefined();
    });
});

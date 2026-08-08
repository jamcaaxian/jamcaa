import { describe, expect, it } from "vitest";
import { assertGrantsAreDeclared, coreCapabilities, mergeCapabilities } from "./capabilities";
import { grantEverything } from "./roles";

describe("mergeCapabilities", () => {
    it("combines catalogues from several contributors", () => {
        const merged = mergeCapabilities({ post: ["read"] }, { newsletter: ["send"] });

        expect(merged).toEqual({ post: ["read"], newsletter: ["send"] });
    });

    it("refuses two contributors claiming the same resource", () => {
        expect(() => mergeCapabilities({ post: ["read"] }, { post: ["write"] })).toThrow(
            /Duplicate capability resource: post/
        );
    });
});

describe("assertGrantsAreDeclared", () => {
    const catalogue = { post: ["read", "publish-any"] };

    it("accepts grants drawn from the catalogue", () => {
        expect(() => assertGrantsAreDeclared(catalogue, { post: ["read"] })).not.toThrow();
    });

    it("rejects a resource nothing declares", () => {
        expect(() => assertGrantsAreDeclared(catalogue, { invoice: ["read"] })).toThrow(
            /Unknown capability resource: invoice/
        );
    });

    it("rejects an action the resource does not declare", () => {
        expect(() => assertGrantsAreDeclared(catalogue, { post: ["destroy"] })).toThrow(
            /Unknown capability action: post:destroy/
        );
    });
});

describe("grantEverything", () => {
    it("covers every action in the catalogue", () => {
        const granted = grantEverything(coreCapabilities);

        for (const [resource, actions] of Object.entries(coreCapabilities)) {
            expect(granted[resource]).toEqual([...actions]);
        }
    });

    it("returns copies so callers cannot mutate the catalogue", () => {
        const granted = grantEverything({ post: ["read"] });
        granted.post?.push("write");

        expect(coreCapabilities.post).not.toContain("write");
    });
});

import { describe, expect, it } from "vitest";
import { transferModeFor } from "@/lib/media-transfer";

describe("choosing the media transfer path", () => {
    it("keeps small files on the server path", () => {
        expect(transferModeFor(4_999_999, 5_000_000)).toBe("server");
    });

    it("hands large files to the browser", () => {
        expect(transferModeFor(5_000_000, 5_000_000)).toBe("direct");
    });
});

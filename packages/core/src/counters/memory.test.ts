import { describe, expect, it } from "vitest";
import { memoryCounterPort } from "./memory";

const target = { collectionName: "post", entryId: "entry-1" };

describe("memory counter port", () => {
    it("counts one target per kind independently", async () => {
        const port = memoryCounterPort();

        expect(await port.increment(target, "view")).toBe(1);
        expect(await port.increment(target, "view", 4)).toBe(5);
        expect(await port.increment(target, "like")).toBe(1);
        expect(await port.read(target, "view")).toBe(5);
        expect(await port.read(target, "like")).toBe(1);
        expect(await port.read(target, "bookmark")).toBe(0);
    });

    it("keeps targets apart and seeds initial counts", async () => {
        const port = memoryCounterPort({ "post\u0000entry-1\u0000view": 9 });

        expect(await port.increment({ collectionName: "post", entryId: "entry-2" }, "view")).toBe(1);
        expect(await port.read(target, "view")).toBe(9);
        expect(port.counts.get("post\u0000entry-1\u0000view")).toBe(9);
    });

    it("refuses zero and negative increments", async () => {
        const port = memoryCounterPort();

        await expect(port.increment(target, "view", 0)).rejects.toThrow(/positive integer/);
        await expect(port.increment(target, "view", -2)).rejects.toThrow(/positive integer/);
    });

    it("reads many requests in order", async () => {
        const port = memoryCounterPort();

        await port.increment(target, "view", 3);
        await port.increment(target, "like");

        expect(
            await port.readMany([
                { target, kind: "view" },
                { target, kind: "like" },
                { target: { collectionName: "post", entryId: "entry-2" }, kind: "bookmark" }
            ])
        ).toEqual([
            { target, kind: "view", count: 3 },
            { target, kind: "like", count: 1 },
            { target: { collectionName: "post", entryId: "entry-2" }, kind: "bookmark", count: 0 }
        ]);
    });
});

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { counterNamespacePort, counterServicePort } from "@jamcaa/core/counters";
import type { CounterDurableObject } from "@jamcaa/core/counters/durable-object";

// The generated Site env types declare COUNTERS as a service-binding Fetcher;
// in this suite the same binding name carries the namespace of the main Worker.
const counters = env.COUNTERS as unknown as DurableObjectNamespace<CounterDurableObject>;

const target = { collectionName: "post", entryId: "entry-1" };

describe("Durable Object counters", () => {
    it("counts one target per kind through the namespace port", async () => {
        const port = counterNamespacePort(counters);

        expect(await port.increment(target, "view")).toBe(1);
        expect(await port.increment(target, "view", 4)).toBe(5);
        expect(await port.increment(target, "like")).toBe(1);
        expect(await port.read(target, "view")).toBe(5);
        expect(await port.read(target, "bookmark")).toBe(0);
    });

    it("keeps targets apart and persists across calls", async () => {
        const port = counterNamespacePort(counters);
        const other = { collectionName: "post", entryId: "entry-2" };

        await port.increment(target, "view");
        await port.increment(other, "view");

        expect(await port.read(target, "view")).toBe(6);
        expect(await port.read(other, "view")).toBe(1);

        const counts = await port.readMany([
            { target, kind: "view" },
            { target: other, kind: "view" }
        ]);

        expect(counts).toEqual([
            { target, kind: "view", count: 6 },
            { target: other, kind: "view", count: 1 }
        ]);
    });

    it("routes the counters Worker and serves the service-binding protocol", async () => {
        const port = counterServicePort(SELF);

        expect(await port.increment({ collectionName: "post", entryId: "entry-3" }, "bookmark", 2)).toBe(2);
        expect(await port.read({ collectionName: "post", entryId: "entry-3" }, "bookmark")).toBe(2);
    });

    it("refuses malformed JSON with a 400 rather than crashing", async () => {
        await expect(
            SELF.fetch(new Request("https://counters/increment", { method: "POST", body: "not json" }))
        ).resolves.toMatchObject({ status: 400 });

        await expect(
            counters
                .get(counters.idFromName("post:entry-9"))
                .fetch(new Request("https://counters/read", { method: "POST", body: "{" }))
        ).resolves.toMatchObject({ status: 400 });
    });

    it("refuses unknown kinds and invalid increments at the Durable Object", async () => {
        const port = counterNamespacePort(counters);

        await expect(
            counters
                .get(counters.idFromName("post:entry-9"))
                .fetch(
                    new Request("https://counters/increment", {
                        method: "POST",
                        body: JSON.stringify({ target, kind: "vote" })
                    })
                )
        ).resolves.toMatchObject({ status: 400 });

        await expect(port.increment(target, "view", 0)).rejects.toThrow(/400/);
        await expect(port.read(target, "view")).resolves.toBe(6);
    });
});

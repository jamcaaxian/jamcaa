import { DurableObject } from "cloudflare:workers";
import type { CounterKind } from "./port";

/**
 * One serialised execution unit per counted target (ADR-0007). The JSON wire
 * shape below is shared by the namespace adapter and the service adapter, so
 * the counters Worker is a thin router in front of its own namespace.
 *
 * This module imports the Workers runtime and is therefore consumed only by
 * Workers; Site bundles reach counters through the adapters in `./durable`.
 */

function counterKey(target: { collectionName: string; entryId: string }, kind: CounterKind): string {
    return `${target.collectionName}\u0000${target.entryId}\u0000${kind}`;
}

function responseJson(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function isCounterKind(kind: unknown): kind is CounterKind {
    return kind === "view" || kind === "like" || kind === "bookmark";
}

export class CounterDurableObject extends DurableObject {
    constructor(state: DurableObjectState, env: Cloudflare.Env) {
        super(state, env);
    }

    override async fetch(request: Request): Promise<Response> {
        const pathname = new URL(request.url).pathname;

        if (pathname !== "/increment" && pathname !== "/read") {
            return new Response("Not found", { status: 404 });
        }

        let body: { target?: unknown; kind?: unknown; by?: unknown };

        try {
            body = (await request.json()) as { target?: unknown; kind?: unknown; by?: unknown };
        } catch {
            return responseJson({ error: "A counter request must be JSON." }, 400);
        }

        const target = body.target as { collectionName?: unknown; entryId?: unknown } | undefined;

        if (
            typeof target?.collectionName !== "string"
            || typeof target.entryId !== "string"
            || !isCounterKind(body.kind)
        ) {
            return responseJson({ error: "A counter request needs a collection, an Entry, and a known kind." }, 400);
        }

        const checkedTarget = { collectionName: target.collectionName, entryId: target.entryId };

        if (pathname === "/increment") {
            const by = body.by === undefined ? 1 : body.by;

            if (typeof by !== "number" || !Number.isInteger(by) || by < 1) {
                return responseJson({ error: "A counter increment must be a positive integer." }, 400);
            }

            const key = counterKey(checkedTarget, body.kind);
            const current = (await this.ctx.storage.get<number>(key)) ?? 0;
            const next = current + by;

            await this.ctx.storage.put(key, next);
            return responseJson({ count: next });
        }

        const count = (await this.ctx.storage.get<number>(counterKey(checkedTarget, body.kind))) ?? 0;

        return responseJson({ count });
    }
}

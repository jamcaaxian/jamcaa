import { CounterDurableObject } from "@jamcaaxian/core/counters/durable-object";

export { CounterDurableObject };

interface CounterEnv {
    COUNTERS: DurableObjectNamespace<CounterDurableObject>;
}

/**
 * A thin router in front of the Site's counter namespace. The Site's main
 * Worker reaches counters through a service binding (ADR-0007), because a
 * Next-on-Workers bundle cannot export its own Durable Object classes.
 */
const countersRouter: ExportedHandler<CounterEnv> = {
    async fetch(request: Request, env: CounterEnv): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname !== "/increment" && url.pathname !== "/read") {
            return new Response("Not found", { status: 404 });
        }

        const text = await request.text();

        let body: { target?: { collectionName?: unknown; entryId?: unknown } };

        try {
            body = JSON.parse(text) as { target?: { collectionName?: unknown; entryId?: unknown } };
        } catch {
            return new Response('{"error":"A counter request must be JSON."}', {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }

        if (typeof body?.target?.collectionName !== "string" || typeof body.target?.entryId !== "string") {
            return new Response('{"error":"A counter request needs a collection and an Entry."}', {
                status: 400,
                headers: { "content-type": "application/json" }
            });
        }

        const stub = env.COUNTERS.get(env.COUNTERS.idFromName(`${body.target.collectionName}:${body.target.entryId}`));

        return await stub.fetch(new Request(request.url, { method: request.method, body: text }));
    }
};

export default countersRouter;

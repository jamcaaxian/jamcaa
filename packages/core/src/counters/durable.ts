import type { CounterDurableObject } from "./durable-object";
import type { CounterKind, CounterPort, CounterTarget } from "./port";

/**
 * Adapters over the counters wire protocol (POST /increment and /read with
 * JSON bodies). Worker-safe: the Durable Object class itself lives in
 * `./durable-object`, which only Workers import.
 */

interface IncrementBody {
    target: CounterTarget;
    kind: CounterKind;
    by?: number;
}

interface ReadBody {
    target: CounterTarget;
    kind: CounterKind;
}

interface CountResponse {
    count?: number;
}

async function expectCount(response: Response): Promise<number> {
    const body = (await response.json()) as CountResponse;

    if (body.count === undefined) {
        throw new Error(`The counters Worker answered ${response.status}.`);
    }

    return body.count;
}

/** Counters reached directly through a DurableObjectNamespace binding. */
export function counterNamespacePort(namespace: DurableObjectNamespace<CounterDurableObject>): CounterPort {
    const request = async (target: CounterTarget, pathname: string, body: unknown): Promise<number> => {
        const response = await namespace
            .get(namespace.idFromName(`${target.collectionName}:${target.entryId}`))
            .fetch(new Request(`https://counters${pathname}`, { method: "POST", body: JSON.stringify(body) }));

        return await expectCount(response);
    };

    return {
        async increment(target, kind, by = 1) {
            return await request(target, "/increment", { target, kind, by } satisfies IncrementBody);
        },

        async read(target, kind) {
            return await request(target, "/read", { target, kind } satisfies ReadBody);
        },

        async readMany(requests) {
            return await Promise.all(
                requests.map(async item => ({
                    ...item,
                    count: await request(item.target, "/read", {
                        target: item.target,
                        kind: item.kind
                    } satisfies ReadBody)
                }))
            );
        }
    };
}

/** Counters reached through a service binding to a counters Worker. */
export function counterServicePort(fetcher: Fetcher): CounterPort {
    const post = async (pathname: string, body: unknown): Promise<number> => {
        const response = await fetcher.fetch(
            new Request(`https://counters${pathname}`, { method: "POST", body: JSON.stringify(body) })
        );

        return await expectCount(response);
    };

    return {
        async increment(target, kind, by = 1) {
            return await post("/increment", { target, kind, by } satisfies IncrementBody);
        },

        async read(target, kind) {
            return await post("/read", { target, kind } satisfies ReadBody);
        },

        async readMany(requests) {
            return await Promise.all(
                requests.map(async request => ({
                    ...request,
                    count: await post("/read", { target: request.target, kind: request.kind } satisfies ReadBody)
                }))
            );
        }
    };
}

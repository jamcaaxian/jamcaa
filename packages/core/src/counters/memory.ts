import type { CounterKind, CounterPort, CounterReadResult, CounterTarget } from "./port";

function key(target: CounterTarget, kind: CounterKind): string {
    return `${target.collectionName}\u0000${target.entryId}\u0000${kind}`;
}

export interface MemoryCounterPort extends CounterPort {
    /** Every recorded count, for assertions. */
    counts: ReadonlyMap<string, number>;
}

/** In-memory counters for tests and for Sites without a counters Worker. */
export function memoryCounterPort(initial?: Readonly<Record<string, number>>): MemoryCounterPort {
    const counts = new Map(Object.entries(initial ?? {}));

    return {
        counts,

        async increment(target, kind, by = 1) {
            if (!Number.isInteger(by) || by < 1) {
                throw new Error("A counter increment must be a positive integer.");
            }

            const counterKey = key(target, kind);
            const next = (counts.get(counterKey) ?? 0) + by;

            counts.set(counterKey, next);
            return next;
        },

        async read(target, kind) {
            return counts.get(key(target, kind)) ?? 0;
        },

        async readMany(requests) {
            const results: CounterReadResult[] = [];

            for (const request of requests) {
                results.push({ ...request, count: counts.get(key(request.target, request.kind)) ?? 0 });
            }

            return results;
        }
    };
}

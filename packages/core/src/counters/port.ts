/**
 * Counters are the fifth runtime port (ADR-0010) and live in Durable Objects
 * (ADR-0007). The port shape is deliberately minimal: monotonic counts per
 * Entry per kind, with no per-user deduplication in v1.
 */

export type CounterKind = "view" | "like" | "bookmark";

export interface CounterTarget {
    collectionName: string;
    entryId: string;
}

export interface CounterRequest {
    target: CounterTarget;
    kind: CounterKind;
}

export interface CounterReadResult extends CounterRequest {
    count: number;
}

export interface CounterPort {
    /** Adds `by` (a positive integer, default 1) and returns the new count. */
    increment(target: CounterTarget, kind: CounterKind, by?: number): Promise<number>;
    read(target: CounterTarget, kind: CounterKind): Promise<number>;
    readMany(requests: readonly CounterRequest[]): Promise<CounterReadResult[]>;
}

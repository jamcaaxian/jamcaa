# Built for Cloudflare, with runtime dependencies behind ports

The framework targets the Cloudflare runtime and ships Cloudflare adapters only in its first version. But five dependencies — database, cache, object storage, counters, and search — are reached through port interfaces whose implementations can be swapped.

Why not aim for general portability: the established content management frameworks all require a long-running Node.js process and cannot run in a stateless, short-lived edge runtime. Focusing on that runtime is a concrete position with no mature competitor. Attempting to support every runtime at once would mean competing head-on with projects years ahead, while maintaining several implementations of every abstraction.

Why the ports exist anyway: beyond leaving room for the community to contribute adapters for other runtimes, the more immediate benefit is that **core logic can be unit tested away from any cloud environment** — substitute in-memory implementations for every port and the great majority of core behaviour becomes verifiable in an ordinary test process. Without this layer the core is effectively untestable.

## Consequences

Ports cost an extra layer of indirection and the maintenance of the interfaces themselves. In exchange, core logic may never reference runtime-specific globals or bindings directly and must go through a port. This constraint has to be enforced in review, or the ports will be hollowed out one shortcut at a time.

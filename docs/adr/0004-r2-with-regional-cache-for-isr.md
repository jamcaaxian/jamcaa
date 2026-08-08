# Incremental cache on R2, wrapped in a regional cache

The incremental cache for generated pages is written to R2 object storage, wrapped in a regional cache in `long-lived` mode to recover read speed.

## Considered Options

- **Workers KV**: readable everywhere once written, with a fast read path. But the adapter's maintainers explicitly advise against using it as the incremental cache, because it is **eventually consistent**. For a content platform that property maps directly onto a specific class of failure: after an editor publishes and triggers on-demand revalidation, some regions may keep serving the old version for an indeterminate window — experienced as "I published it and it isn't showing".
- **Workers Static Assets**: read-only, with **no support for revalidation**. Suitable only for fully static sites, and unable to carry a publishing workflow.
- **R2 with a regional cache** (adopted): R2 writes are strongly consistent, so behaviour after publishing is predictable; the regional cache re-uses fetched entries at the edge, offsetting the latency of single-region object storage.

The decisive point is that consistency and read speed were not actually a binary choice. R2's read latency alone is worse than KV's, but a regional cache largely erases that gap — whereas no amount of caching can repair inconsistency.

## Consequences

The full caching arrangement needs two further components: time-based revalidation depends on a Durable Objects queue, and on-demand revalidation (`revalidateTag` / `revalidatePath`) depends on a D1-backed tag cache. Both fall within decisions already made and introduce no new kind of infrastructure.

A regional cache means fetched entries are re-used at the edge for a period. If "there is still a short delay after publishing" is ever reported, check the regional cache's mode and invalidation settings before blaming the storage layer.

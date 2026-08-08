import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Storage choices are recorded in docs/adr/0004-r2-with-regional-cache-for-isr.md
export default defineCloudflareConfig({
    incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
    queue: doQueue,
    tagCache: d1NextTagCache
});

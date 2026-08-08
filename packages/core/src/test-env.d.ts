/// <reference types="@cloudflare/vitest-pool-workers/types" />

// Bindings declared in vitest.config.ts, surfaced to tests through `cloudflare:test`.
declare namespace Cloudflare {
    interface Env {
        DB: D1Database;
    }
}

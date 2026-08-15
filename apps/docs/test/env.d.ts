/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
    interface Env {
        UPGRADE_DB: D1Database;
        TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
        TEST_PRE_LOCALE_MIGRATIONS: import("cloudflare:test").D1Migration[];
        TEST_LOCALE_MIGRATIONS: import("cloudflare:test").D1Migration[];
        TEST_DOCS: Record<string, string>;
    }
}

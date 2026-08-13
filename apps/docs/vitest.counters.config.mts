import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Counters run in a separate Worker (ADR-0007), so their tests use their own
 * pool with the counters Worker as the main Worker and a real DO namespace.
 */
export default defineConfig({
    plugins: [
        cloudflareTest({
            main: "./counters/worker.ts",
            miniflare: {
                compatibilityDate: "2026-08-08",
                compatibilityFlags: ["nodejs_compat"],
                durableObjects: { COUNTERS: { className: "CounterDurableObject" } }
            }
        })
    ],
    resolve: { alias: { "@": path.resolve("src") } },
    test: { include: ["test/counters.test.ts"], fileParallelism: false }
});

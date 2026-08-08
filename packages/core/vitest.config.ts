import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Core talks to D1, so its tests run inside the real workerd runtime rather than
// against a mock. Bindings are declared inline; no wrangler config is needed.
export default defineConfig({
    plugins: [
        cloudflareTest({
            miniflare: { compatibilityDate: "2026-08-08", compatibilityFlags: ["nodejs_compat"], d1Databases: ["DB"] }
        })
    ]
});

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests live here rather than in the core because this is where the
// migrations are: the core must not depend on any particular site. See docs/adr/0010.
export default defineConfig({
    plugins: [
        cloudflareTest(async () => ({
            miniflare: {
                compatibilityDate: "2026-08-08",
                compatibilityFlags: ["nodejs_compat"],
                d1Databases: ["DB"],
                bindings: {
                    TEST_MIGRATIONS: await readD1Migrations(path.resolve("migrations")),
                    BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
                    BETTER_AUTH_URL: "http://localhost:3000"
                }
            }
        }))
    ],
    test: {
        setupFiles: ["./test/apply-migrations.ts"]
    }
});

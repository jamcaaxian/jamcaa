import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { configDefaults, defineConfig } from "vitest/config";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

async function readDocsRecord(): Promise<Record<string, string>> {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const record: Record<string, string> = {};

    for (const file of ["CONTEXT.md", "README.md"]) {
        record[file] = await readFile(path.join(root, file), "utf8");
    }

    for (const folder of ["docs/adr", "docs/agents"]) {
        for (const name of await readdir(path.join(root, folder))) {
            record[`${folder}/${name}`] = await readFile(path.join(root, folder, name), "utf8");
        }
    }

    return record;
}

// Integration tests live here rather than in the core because this is where the
// migrations are: the core must not depend on any particular site. See docs/adr/0010.
export default defineConfig({
    plugins: [
        cloudflareTest(async () => {
            const migrations = await readD1Migrations(path.resolve("migrations"));

            return {
                miniflare: {
                    compatibilityDate: "2026-08-08",
                    compatibilityFlags: ["nodejs_compat"],
                    d1Databases: ["DB", "UPGRADE_DB"],
                    // The same bindings the deployed Worker has, so a test that asks
                    // whether storage is reachable is asking about something real.
                    r2Buckets: ["MEDIA_BUCKET"],
                    bindings: {
                        TEST_MIGRATIONS: migrations,
                        TEST_PRE_LOCALE_MIGRATIONS: migrations.filter(migration => migration.name < "0015_"),
                        TEST_LOCALE_MIGRATIONS: migrations.filter(migration => migration.name >= "0015_"),
                        TEST_DOCS: await readDocsRecord(),
                        BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
                        BETTER_AUTH_URL: "http://localhost:2727"
                    }
                }
            };
        })
    ],
    resolve: { alias: { "@": path.resolve("src") } },
    test: {
        setupFiles: ["./test/apply-migrations.ts"],
        exclude: [...configDefaults.exclude, "test/search-migration-workflow.test.ts", "test/counters.test.ts"]
    }
});

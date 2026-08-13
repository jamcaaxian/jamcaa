import { defineConfig } from "vitest/config";

/** Generates the docs migration SQL with plain Node; no Worker environment. */
export default defineConfig({
    test: { environment: "node", include: ["scripts/generate-docs-migration-sql.ts"], fileParallelism: false }
});

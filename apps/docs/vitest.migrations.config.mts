import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: { alias: { "@": path.resolve("src") } },
    test: { environment: "node", include: ["test/search-migration-workflow.test.ts"] }
});

import { defineConfig } from "drizzle-kit";

// Migrations belong to the site, not to the core: the final schema is the core's
// tables plus whatever collections this site declares. See docs/adr/0001.
export default defineConfig({
    dialect: "sqlite",
    schema: ["../../packages/core/src/db/schema/index.ts", "./src/content/schema.ts"],
    out: "./migrations"
});

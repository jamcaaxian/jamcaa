import { applyD1Migrations, env } from "cloudflare:test";

// Each test worker starts with an empty database; bring it up to the current schema.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

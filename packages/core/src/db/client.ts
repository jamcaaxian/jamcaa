import { drizzle, type AnyD1Database, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema/index";

export type Database = DrizzleD1Database<typeof schema> & { $client: AnyD1Database };

/**
 * The core never reaches for a runtime binding itself — callers pass one in.
 * This is what lets core logic be exercised without a cloud environment.
 */
export function createDatabase(binding: D1Database): Database {
    return drizzle(binding, { schema });
}

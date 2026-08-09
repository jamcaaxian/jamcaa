import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const setting = sqliteTable("setting", {
    key: text("key").primaryKey(),
    // JSON, so one column holds text, flags, numbers and choices alike.
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        .notNull()
});

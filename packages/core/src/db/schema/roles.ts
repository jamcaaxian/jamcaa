import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const role = sqliteTable("role", {
    name: text("name").primaryKey(),
    label: text("label").notNull(),
    description: text("description"),
    // System roles ship with the platform and cannot be deleted, only re-granted.
    isSystem: integer("is_system", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        .notNull()
});

export const roleCapability = sqliteTable(
    "role_capability",
    {
        roleName: text("role_name")
            .notNull()
            .references(() => role.name, { onDelete: "cascade" }),
        resource: text("resource").notNull(),
        action: text("action").notNull()
    },
    (table) => [primaryKey({ columns: [table.roleName, table.resource, table.action] })]
);

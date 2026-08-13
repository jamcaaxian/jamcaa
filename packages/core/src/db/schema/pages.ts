import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A freely created page addressed by its own public path and built from
 * Blocks. Pages are not Entries: they have no Collection, Taxonomy, or
 * search presence, and exist to give a Site arbitrary composed addresses
 * such as a home page, an about page, or a portfolio.
 */
export const page = sqliteTable(
    "page",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        /** Public address, starting with "/". "/" is the home page. */
        address: text("address").notNull(),
        /** JSON: a BlockDocument validated against the site's registry. */
        body: text("body").notNull(),
        status: text("status", { enum: ["draft", "published"] })
            .notNull()
            .default("draft"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
    },
    table => [uniqueIndex("page_address").on(table.address)]
);

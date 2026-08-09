import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import { user } from "../db/schema/auth";

export const entryStatuses = ["draft", "published", "archived"] as const;

export type EntryStatus = (typeof entryStatuses)[number];

/**
 * Built fresh per collection: Drizzle's column builders carry state once attached
 * to a table, so sharing one instance across two tables corrupts both.
 */
export function systemColumns() {
    return {
        id: text("id").primaryKey(),
        slug: text("slug").notNull(),
        status: text("status", { enum: entryStatuses }).notNull().default("draft"),
        authorId: text("author_id")
            .notNull()
            .references(() => user.id),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .notNull()
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .notNull()
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
        publishedAt: integer("published_at", { mode: "timestamp_ms" })
    };
}

export const systemFieldNames = Object.keys(systemColumns());

export interface SystemFields {
    id: string;
    slug: string;
    status: EntryStatus;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
}

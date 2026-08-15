import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import { user } from "../db/schema/auth";
import { category } from "../db/schema/taxonomy";

export const entryStatuses = ["draft", "published", "archived"] as const;

export type EntryStatus = (typeof entryStatuses)[number];

/**
 * Built fresh per collection: Drizzle's column builders carry state once attached
 * to a table, so sharing one instance across two tables corrupts both.
 */
export function systemColumns() {
    return {
        id: text("id").primaryKey(),
        /** Canonical BCP 47 Locale; `und` keeps non-localised Sites compatible. */
        locale: text("locale").notNull().default("und"),
        /** Stable identity shared by all translations of one Entry. */
        translationId: text("translation_id"),
        slug: text("slug").notNull(),
        status: text("status", { enum: entryStatuses }).notNull().default("draft"),
        authorId: text("author_id")
            .notNull()
            .references(() => user.id),
        categoryId: text("category_id")
            .notNull()
            .references(() => category.id),
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
    locale: string;
    translationId: string;
    slug: string;
    status: EntryStatus;
    authorId: string;
    categoryId: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
}

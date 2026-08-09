import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const bucket = sqliteTable("bucket", {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    // A bucket in this account is reached through a binding fixed at deploy time; any
    // other S3-compatible endpoint is reached by signing. See docs/adr/0005.
    kind: text("kind", { enum: ["binding", "s3"] }).notNull(),
    /** For "binding": the name it has in the Worker's environment. */
    binding: text("binding"),
    /** For "s3": where to reach it, and the credentials to sign with, sealed. */
    endpoint: text("endpoint"),
    region: text("region"),
    bucketName: text("bucket_name"),
    accessKeyId: text("access_key_id"),
    secretAccessKey: text("secret_access_key"),
    /** Where objects in this bucket are served to readers from. */
    publicUrl: text("public_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        .notNull()
});

export const storageRule = sqliteTable(
    "storage_rule",
    {
        id: text("id").primaryKey(),
        label: text("label").notNull(),
        bucketId: text("bucket_id")
            .notNull()
            .references(() => bucket.id),
        /** Lowest first. The first rule that matches decides, so order is the whole rule. */
        priority: integer("priority").notNull().default(0),
        isFallback: integer("is_fallback", { mode: "boolean" }).notNull().default(false),
        /** JSON. Rules are few and are judged in memory, so conditions need not be columns. */
        conditions: text("conditions").notNull().default("{}"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
            .notNull()
    },
    table => [
        // ADR-0005 requires exactly one fallback; the database is what guarantees it.
        uniqueIndex("storage_rule_one_fallback")
            .on(table.isFallback)
            .where(sql`${table.isFallback} = 1`)
    ]
);

export const media = sqliteTable("media", {
    id: text("id").primaryKey(),
    // Which bucket this file actually lives in. Rules decide where new files go and
    // are never applied to files already stored, so this cannot be recomputed.
    bucketId: text("bucket_id")
        .notNull()
        .references(() => bucket.id),
    /** The object's key within that bucket. */
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    // "pending" until the upload is confirmed. A row that stays pending is an upload
    // whose callback never arrived, and is what the reclamation sweep looks for.
    state: text("state", { enum: ["pending", "stored"] })
        .notNull()
        .default("pending"),
    uploaderId: text("uploader_id")
        .notNull()
        .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        .notNull()
});

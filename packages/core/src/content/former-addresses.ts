import { and, eq, getTableColumns } from "drizzle-orm";
import { foreignKey, index, integer, primaryKey, sqliteTable, text, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { canonicalLocale, type LocaleCatalogue } from "../i18n";

export function buildFormerAddressTable(collectionName: string, entryTable: SQLiteTable) {
    const entryId = getTableColumns(entryTable).id;

    if (entryId === undefined) {
        throw new Error(`Collection "${collectionName}" has no Entry identifier.`);
    }

    return sqliteTable(
        `_jamcaa_${collectionName}_former_address`,
        {
            locale: text("locale").notNull().default("und"),
            path: text("path").notNull(),
            entryId: text("entry_id").notNull(),
            createdAt: integer("created_at", { mode: "timestamp_ms" })
                .notNull()
                .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
        },
        table => [
            primaryKey({ columns: [table.locale, table.path] }),
            foreignKey({ columns: [table.entryId], foreignColumns: [entryId] }).onDelete("cascade"),
            index(`_jamcaa_${collectionName}_former_address_entry_idx`).on(table.entryId)
        ]
    );
}

export interface FormerAddressStore {
    retain(entryId: string, path: string, locale?: string): Promise<void>;
    forget(entryId: string, path: string, locale?: string): Promise<void>;
    entryAt(path: string, locale?: string): Promise<string | undefined>;
    pathsFor(entryId: string): Promise<string[]>;
    all(): Promise<{ locale: string; path: string; entryId: string }[]>;
}

export function formerAddressStore(
    database: Database,
    table: ReturnType<typeof buildFormerAddressTable>,
    locales?: LocaleCatalogue
): FormerAddressStore {
    const defaultLocale = locales?.defaultLocale ?? "und";

    function locale(value?: string): string {
        const candidate = value?.trim() || defaultLocale;
        const supported = locales?.canonical(candidate);

        if (locales !== undefined) {
            if (supported === undefined) {
                throw new Error(`Locale "${candidate}" is not supported by this Site.`);
            }

            return supported;
        }

        return canonicalLocale(candidate);
    }

    return {
        async retain(entryId, path, requestedLocale) {
            const entryLocale = locale(requestedLocale);
            const existing = await database
                .select({ entryId: table.entryId })
                .from(table)
                .where(and(eq(table.locale, entryLocale), eq(table.path, path)))
                .limit(1);
            const owner = existing[0]?.entryId;

            if (owner !== undefined && owner !== entryId) {
                throw new Error("That Former Address belongs to another Entry.");
            }

            if (owner === undefined) {
                await database.insert(table).values({ locale: entryLocale, path, entryId });
            }
        },

        async forget(entryId, path, requestedLocale) {
            await database
                .delete(table)
                .where(
                    and(eq(table.entryId, entryId), eq(table.locale, locale(requestedLocale)), eq(table.path, path))
                );
        },

        async entryAt(path, requestedLocale) {
            const rows = await database
                .select({ entryId: table.entryId })
                .from(table)
                .where(and(eq(table.locale, locale(requestedLocale)), eq(table.path, path)))
                .limit(1);

            return rows[0]?.entryId;
        },

        async pathsFor(entryId) {
            const rows = await database.select({ path: table.path }).from(table).where(eq(table.entryId, entryId));

            return rows.map(row => row.path).sort();
        },

        async all() {
            return database.select({ locale: table.locale, path: table.path, entryId: table.entryId }).from(table);
        }
    };
}

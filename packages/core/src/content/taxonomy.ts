import { eq, getTableColumns, getTableName } from "drizzle-orm";
import { foreignKey, index, primaryKey, sqliteTable, text, type SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import { category, tag } from "../db/schema/taxonomy";
import { toSlug } from "./slug";

export interface Category {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Tag {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}

export function buildTagRelationTable(collectionName: string, entryTable: SQLiteTable) {
    const entryId = getTableColumns(entryTable).id;

    if (entryId === undefined) {
        throw new Error(`Collection "${collectionName}" has no Entry identifier.`);
    }

    return sqliteTable(
        `_jamcaa_${collectionName}_tag`,
        {
            entryId: text("entry_id").notNull(),
            tagId: text("tag_id")
                .notNull()
                .references(() => tag.id)
        },
        table => [
            primaryKey({ columns: [table.entryId, table.tagId] }),
            foreignKey({ columns: [table.entryId], foreignColumns: [entryId] }).onDelete("cascade"),
            index(`_jamcaa_${collectionName}_tag_term_idx`).on(table.tagId, table.entryId)
        ]
    );
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

export function tagMembershipStore(database: Database, relationTable: SQLiteTable) {
    const tableName = quoteIdentifier(getTableName(relationTable));

    return {
        async listForEntry(entryId: string): Promise<string[]> {
            const rows = await database.$client
                .prepare(`SELECT tag_id AS tagId FROM ${tableName} WHERE entry_id = ? ORDER BY tag_id`)
                .bind(entryId)
                .all<{ tagId: string }>();

            return rows.results.map(row => row.tagId);
        },

        async replaceForEntry(entryId: string, tagIds: readonly string[]): Promise<void> {
            await database.$client.batch(tagMembershipStatements(database, relationTable, entryId, tagIds));
        }
    };
}

export function tagMembershipStatements(
    database: Database,
    relationTable: SQLiteTable,
    entryId: string,
    tagIds: readonly string[]
): D1PreparedStatement[] {
    const tableName = quoteIdentifier(getTableName(relationTable));
    const unique = [...new Set(tagIds)];
    const statements = [database.$client.prepare(`DELETE FROM ${tableName} WHERE entry_id = ?`).bind(entryId)];

    if (unique.length > 0) {
        const values = unique.map(() => "(?, ?)").join(", ");
        const bindings = unique.flatMap(tagId => [entryId, tagId]);
        statements.push(
            database.$client.prepare(`INSERT INTO ${tableName} (entry_id, tag_id) VALUES ${values}`).bind(...bindings)
        );
    }

    return statements;
}

function termSlug(name: string, slug: string | undefined): string {
    const resolved = toSlug(slug || name);

    if (!resolved) {
        throw new Error("A taxonomy term needs a name or slug that produces an address.");
    }

    return resolved;
}

export function taxonomyStore(database: Database) {
    async function categoryById(id: string): Promise<Category | undefined> {
        return await database.select().from(category).where(eq(category.id, id)).get();
    }

    async function tagById(id: string): Promise<Tag | undefined> {
        return await database.select().from(tag).where(eq(tag.id, id)).get();
    }

    async function ensureParentDoesNotCycle(id: string, parentId: string | null): Promise<void> {
        let cursor = parentId;
        const visited = new Set<string>();

        while (cursor !== null) {
            if (cursor === id) {
                throw new Error("A Category cannot become its own descendant.");
            }

            if (visited.has(cursor)) {
                throw new Error("The existing Category hierarchy contains a cycle.");
            }

            visited.add(cursor);
            const parent = await categoryById(cursor);

            if (parent === undefined) {
                throw new Error("The parent Category does not exist.");
            }

            cursor = parent.parentId;
        }
    }

    return {
        listCategories: async (): Promise<Category[]> =>
            await database.select().from(category).orderBy(category.name).all(),

        listTags: async (): Promise<Tag[]> => await database.select().from(tag).orderBy(tag.name).all(),

        categoryById,

        categoryBySlug: async (slug: string): Promise<Category | undefined> =>
            await database.select().from(category).where(eq(category.slug, slug)).get(),

        tagById,

        tagBySlug: async (slug: string): Promise<Tag | undefined> =>
            await database.select().from(tag).where(eq(tag.slug, slug)).get(),

        async createCategory(input: { name: string; slug?: string; parentId?: string | null }): Promise<Category> {
            const id = crypto.randomUUID();
            const name = input.name.trim();

            if (!name) {
                throw new Error("A Category needs a name.");
            }

            if (input.parentId && (await categoryById(input.parentId)) === undefined) {
                throw new Error("The parent Category does not exist.");
            }

            await database
                .insert(category)
                .values({ id, name, slug: termSlug(name, input.slug), parentId: input.parentId ?? null });

            const created = await categoryById(id);

            if (created === undefined) {
                throw new Error("The Category was written but could not be read back.");
            }

            return created;
        },

        async updateCategory(
            id: string,
            changes: { name?: string; slug?: string; parentId?: string | null }
        ): Promise<void> {
            const existing = await categoryById(id);

            if (existing === undefined) {
                throw new Error("That Category does not exist.");
            }

            const parentId = changes.parentId === undefined ? existing.parentId : changes.parentId;

            if (parentId && (await categoryById(parentId)) === undefined) {
                throw new Error("The parent Category does not exist.");
            }

            await ensureParentDoesNotCycle(id, parentId);

            const name = changes.name?.trim() || existing.name;

            await database
                .update(category)
                .set({
                    name,
                    slug: changes.slug === undefined ? existing.slug : termSlug(name, changes.slug),
                    parentId,
                    updatedAt: new Date()
                })
                .where(eq(category.id, id));
        },

        async removeCategory(id: string): Promise<void> {
            const child = await database
                .select({ id: category.id })
                .from(category)
                .where(eq(category.parentId, id))
                .get();

            if (child !== undefined) {
                throw new Error("Move or remove this Category's children first.");
            }

            await database.delete(category).where(eq(category.id, id));
        },

        async createTag(input: { name: string; slug?: string }): Promise<Tag> {
            const id = crypto.randomUUID();
            const name = input.name.trim();

            if (!name) {
                throw new Error("A Tag needs a name.");
            }

            await database.insert(tag).values({ id, name, slug: termSlug(name, input.slug) });

            const created = await tagById(id);

            if (created === undefined) {
                throw new Error("The Tag was written but could not be read back.");
            }

            return created;
        },

        async updateTag(id: string, changes: { name?: string; slug?: string }): Promise<void> {
            const existing = await tagById(id);

            if (existing === undefined) {
                throw new Error("That Tag does not exist.");
            }

            const name = changes.name?.trim() || existing.name;

            await database
                .update(tag)
                .set({
                    name,
                    slug: changes.slug === undefined ? existing.slug : termSlug(name, changes.slug),
                    updatedAt: new Date()
                })
                .where(eq(tag.id, id));
        },

        async removeTag(id: string): Promise<void> {
            await database.delete(tag).where(eq(tag.id, id));
        }
    };
}

export async function writeEntryWithTags<T>(options: {
    database: Database;
    relationTable: SQLiteTable;
    tagIds: readonly string[];
    prepareEntry: () => Promise<{ entry: T; statements: readonly D1PreparedStatement[] }>;
    entryId: (entry: T) => string;
    afterStored?: (entry: T, tagIds: readonly string[]) => Promise<readonly D1PreparedStatement[]>;
}): Promise<T> {
    const prepared = await options.prepareEntry();
    const entryId = options.entryId(prepared.entry);
    const afterStored = (await options.afterStored?.(prepared.entry, options.tagIds)) ?? [];

    await options.database.$client.batch([
        ...prepared.statements,
        ...tagMembershipStatements(options.database, options.relationTable, entryId, options.tagIds),
        ...afterStored
    ]);

    return prepared.entry;
}

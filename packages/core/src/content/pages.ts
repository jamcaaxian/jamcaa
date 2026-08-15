import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { page } from "../db/schema/pages";
import { canonicalLocale, type LocaleCatalogue } from "../i18n";
import { parseBlockDocument, type BlockDocument, type BlockRegistry } from "./blocks";

export type PageStatus = "draft" | "published";

export interface PageRecord {
    id: string;
    locale: string;
    translationId: string;
    title: string;
    address: string;
    body: BlockDocument;
    status: PageStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface PageWrites {
    title?: string;
    address?: string;
    body?: BlockDocument;
    status?: PageStatus;
}

export type PageResult =
    | { status: "created"; page: PageRecord }
    | { status: "updated"; page: PageRecord }
    | { status: "rejected"; message: string };

/** A page address is absolute, starts with "/", and never ends with "/" (except the root). */
export function checkPageAddress(address: string): string | undefined {
    if (address === "/") {
        return undefined;
    }

    if (!address.startsWith("/")) {
        return 'A page address has to start with "/".';
    }

    if (address.length > 1 && address.endsWith("/")) {
        return 'A page address cannot end with "/".';
    }

    if (address.includes("//")) {
        return 'A page address cannot contain "//".';
    }

    return undefined;
}

function readPage(row: typeof page.$inferSelect): PageRecord {
    const parsed = JSON.parse(row.body) as unknown;

    return {
        id: row.id,
        locale: canonicalLocale(row.locale),
        translationId: row.translationId ?? row.id,
        title: row.title,
        address: row.address,
        body: typeof parsed === "object" && parsed !== null ? (parsed as BlockDocument) : { version: 1, blocks: [] },
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export function pageStore(database: Database, registry: BlockRegistry, locales?: LocaleCatalogue) {
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

    async function byId(id: string): Promise<PageRecord | undefined> {
        const [row] = await database.select().from(page).where(eq(page.id, id));

        return row === undefined ? undefined : readPage(row);
    }

    async function validate(
        title: string,
        address: string,
        body: BlockDocument,
        requestedLocale: string,
        exceptId?: string
    ): Promise<string | undefined> {
        const addressProblem = checkPageAddress(address);

        if (addressProblem !== undefined) {
            return addressProblem;
        }

        if (title.trim() === "") {
            return "A page needs a title.";
        }

        const parsed = parseBlockDocument(body, registry);

        if (!parsed.ok) {
            return `The body has problems: ${parsed.errors.join(" ")}`;
        }

        const [existing] = await database
            .select({ id: page.id })
            .from(page)
            .where(and(eq(page.locale, requestedLocale), eq(page.address, address)));

        if (existing !== undefined && existing.id !== exceptId) {
            return `A page at "${address}" already exists.`;
        }

        return undefined;
    }

    return {
        async list(): Promise<PageRecord[]> {
            const rows = await database.select().from(page).orderBy(asc(page.address));

            return rows.map(readPage);
        },

        byId,

        async byAddress(address: string, requestedLocale?: string): Promise<PageRecord | undefined> {
            const [row] = await database
                .select()
                .from(page)
                .where(
                    and(
                        eq(page.locale, locale(requestedLocale)),
                        eq(page.address, address),
                        eq(page.status, "published")
                    )
                );

            return row === undefined ? undefined : readPage(row);
        },

        async translations(translationId: string): Promise<PageRecord[]> {
            const rows = await database
                .select()
                .from(page)
                .where(eq(page.translationId, translationId))
                .orderBy(asc(page.locale));

            return rows.map(readPage);
        },

        async create(input: {
            title: string;
            address: string;
            body: BlockDocument;
            locale?: string;
            translationId?: string;
            status?: PageStatus;
        }): Promise<PageResult> {
            const status = input.status ?? "draft";
            const requestedLocale = locale(input.locale);
            const id = crypto.randomUUID();
            const translationId = input.translationId?.trim() || id;
            const problem = await validate(input.title, input.address, input.body, requestedLocale);

            if (problem !== undefined) {
                return { status: "rejected", message: problem };
            }

            const now = Date.now();

            await database
                .insert(page)
                .values({
                    id,
                    locale: requestedLocale,
                    translationId,
                    title: input.title,
                    address: input.address,
                    body: JSON.stringify(input.body),
                    status,
                    createdAt: new Date(now),
                    updatedAt: new Date(now)
                });

            const created = await byId(id);

            return created === undefined ?
                    { status: "rejected", message: "The page could not be read back." }
                :   { status: "created", page: created };
        },

        async update(id: string, writes: PageWrites): Promise<PageResult> {
            const current = await byId(id);

            if (current === undefined) {
                return { status: "rejected", message: "No such page." };
            }

            const title = writes.title ?? current.title;
            const address = writes.address ?? current.address;
            const body = writes.body ?? current.body;
            const problem = await validate(title, address, body, current.locale, id);

            if (problem !== undefined) {
                return { status: "rejected", message: problem };
            }

            await database
                .update(page)
                .set({
                    title,
                    address,
                    body: JSON.stringify(body),
                    status: writes.status ?? current.status,
                    updatedAt: new Date(Date.now())
                })
                .where(eq(page.id, id));

            const updated = await byId(id);

            return updated === undefined ?
                    { status: "rejected", message: "The page could not be read back." }
                :   { status: "updated", page: updated };
        },

        async delete(id: string): Promise<void> {
            await database.delete(page).where(eq(page.id, id));
        }
    };
}

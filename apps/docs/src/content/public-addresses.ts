import type { EntryOf } from "@jamcaaxian/core/content";
import type { Database } from "@jamcaaxian/core/db";
import { post } from "./collections";
import { docsLocales, type DocsLocale } from "./locales";
import { isReservedPublicAddress, postAddress } from "./public-paths";
import { formerPostAddresses, posts } from "./store";

type Post = EntryOf<typeof post>;

export interface FormerPostResolution {
    entry: Post;
    address: string;
}

function pathOf(pathSegments: readonly string[]): string {
    return `/${pathSegments.join("/")}`;
}

function addressProblem(address: string): Error {
    return new Error(`The public address ${address} is not available.`);
}

export function publicPostAddresses(database: Database) {
    const entries = posts(database);
    const former = formerPostAddresses(database);

    async function allEntries(locale?: DocsLocale): Promise<Post[]> {
        const found: Post[] = [];

        for (let offset = 0; ; offset += 50) {
            const page = await entries.list({ locale, limit: 50, offset });

            found.push(...page);

            if (page.length < 50) {
                return found;
            }
        }
    }

    async function currentOwners(pattern: string, locale: DocsLocale): Promise<Map<string, string>> {
        const owners = new Map<string, string>();

        for (const entry of await allEntries(locale)) {
            const address = postAddress(pattern, entry);
            const existing = owners.get(address);

            if (existing !== undefined && existing !== entry.id) {
                throw addressProblem(address);
            }

            owners.set(address, entry.id);
        }

        return owners;
    }

    async function assertCurrentAvailable(
        entryId: string | undefined,
        address: string,
        locale: DocsLocale = docsLocales.defaultLocale
    ): Promise<void> {
        if (isReservedPublicAddress(address)) {
            throw new Error(`The current canonical address ${address} belongs to the Site itself.`);
        }

        const formerOwner = await former.entryAt(address, locale);

        if (formerOwner !== undefined && formerOwner !== entryId) {
            throw new Error(`The current canonical address ${address} is another Entry's Former Address.`);
        }
    }

    async function retain(
        entryId: string,
        address: string,
        pattern: string,
        locale: DocsLocale = docsLocales.defaultLocale
    ): Promise<void> {
        if (isReservedPublicAddress(address)) {
            throw new Error(`The Former Address ${address} belongs to the Site itself.`);
        }

        const currentOwner = (await currentOwners(pattern, locale)).get(address);

        if (currentOwner !== undefined && currentOwner !== entryId) {
            throw new Error(`The Former Address ${address} is another Entry's canonical address.`);
        }

        await former.retain(entryId, address, locale);
    }

    return {
        assertCurrentAvailable,
        retain,

        async entryChangeStatements(before: Post, after: Post, pattern: string): Promise<D1PreparedStatement[]> {
            const beforeAddress = postAddress(pattern, before);
            const afterAddress = postAddress(pattern, after);
            const statements: D1PreparedStatement[] = [];

            await assertCurrentAvailable(before.id, afterAddress, before.locale as DocsLocale);

            if (
                before.status === "published"
                && (beforeAddress !== afterAddress || after.status !== "published")
                && !isReservedPublicAddress(beforeAddress)
            ) {
                const currentOwner = (await currentOwners(pattern, before.locale as DocsLocale)).get(beforeAddress);

                if (currentOwner !== undefined && currentOwner !== before.id) {
                    throw new Error(`The Former Address ${beforeAddress} is another Entry's canonical address.`);
                }

                statements.push(
                    database.$client
                        .prepare(
                            "INSERT INTO _jamcaa_post_former_address (locale, path, entry_id) VALUES (?, ?, ?) "
                                + "ON CONFLICT(locale, path) DO UPDATE SET entry_id = CASE "
                                + "WHEN _jamcaa_post_former_address.entry_id = excluded.entry_id "
                                + "THEN excluded.entry_id ELSE NULL END"
                        )
                        .bind(before.locale, beforeAddress, before.id)
                );
            }

            if (after.status === "published") {
                statements.push(
                    database.$client
                        .prepare(
                            "DELETE FROM _jamcaa_post_former_address WHERE entry_id = ? AND locale = ? AND path = ?"
                        )
                        .bind(before.id, after.locale, afterAddress)
                );
            }

            return statements;
        },

        async recordEntryChange(before: Post, after: Post, pattern: string): Promise<void> {
            const statements = await this.entryChangeStatements(before, after, pattern);

            if (statements.length > 0) {
                await database.$client.batch(statements);
            }
        },

        async permalinkChangeStatements(beforePattern: string, afterPattern: string): Promise<D1PreparedStatement[]> {
            const everyEntry = await allEntries();
            const retained = await former.all();
            const retainedOwners = new Map(
                retained.map(candidate => [`${candidate.locale}\u0000${candidate.path}`, candidate.entryId])
            );
            const ownersByLocale = new Map<DocsLocale, Map<string, string>>();
            const statements: D1PreparedStatement[] = [];

            for (const locale of docsLocales.locales) {
                ownersByLocale.set(locale, await currentOwners(afterPattern, locale));
            }

            for (const entry of everyEntry) {
                const afterAddress = postAddress(afterPattern, entry);
                const beforeAddress = postAddress(beforePattern, entry);
                const locale = entry.locale as DocsLocale;

                if (isReservedPublicAddress(afterAddress)) {
                    throw new Error(`The current canonical address ${afterAddress} belongs to the Site itself.`);
                }

                const formerOwner = retainedOwners.get(`${locale}\u0000${afterAddress}`);

                if (formerOwner !== undefined && formerOwner !== entry.id) {
                    throw new Error(`The current canonical address ${afterAddress} is another Entry's Former Address.`);
                }

                const currentOwner = ownersByLocale.get(locale)?.get(beforeAddress);

                if (
                    entry.status === "published"
                    && beforeAddress !== afterAddress
                    && currentOwner !== undefined
                    && currentOwner !== entry.id
                ) {
                    throw new Error(`The Former Address ${beforeAddress} is another Entry's canonical address.`);
                }
            }

            for (const entry of everyEntry) {
                const beforeAddress = postAddress(beforePattern, entry);
                const afterAddress = postAddress(afterPattern, entry);

                if (
                    entry.status === "published"
                    && beforeAddress !== afterAddress
                    && !isReservedPublicAddress(beforeAddress)
                ) {
                    statements.push(
                        database.$client
                            .prepare(
                                "INSERT INTO _jamcaa_post_former_address (locale, path, entry_id) VALUES (?, ?, ?) "
                                    + "ON CONFLICT(locale, path) DO UPDATE SET entry_id = CASE "
                                    + "WHEN _jamcaa_post_former_address.entry_id = excluded.entry_id "
                                    + "THEN excluded.entry_id ELSE NULL END"
                            )
                            .bind(entry.locale, beforeAddress, entry.id)
                    );
                }

                if (entry.status === "published") {
                    statements.push(
                        database.$client
                            .prepare(
                                "DELETE FROM _jamcaa_post_former_address WHERE entry_id = ? AND locale = ? AND path = ?"
                            )
                            .bind(entry.id, entry.locale, afterAddress)
                    );
                }
            }

            return statements;
        },

        async formerAt(
            pathSegments: readonly string[],
            pattern: string,
            locale: DocsLocale = docsLocales.defaultLocale
        ): Promise<FormerPostResolution | undefined> {
            const requested = pathOf(pathSegments);

            if (isReservedPublicAddress(requested)) {
                return undefined;
            }

            const entryId = await former.entryAt(requested, locale);
            const entry = entryId === undefined ? undefined : await entries.byId(entryId);

            if (entry?.status !== "published") {
                return undefined;
            }

            const address = postAddress(pattern, entry);

            return address === requested ? undefined : { entry, address };
        }
    };
}

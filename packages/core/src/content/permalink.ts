import { format } from "date-fns";
import type { Collection } from "./collection";
import type { SettingCatalogue } from "../settings/definitions";

export const PERMALINK_PATTERNS = [
    "/{slug}",
    "/{collection}/{slug}",
    "/{year}/{month}/{slug}",
    "/{year}/{month}/{day}/{slug}"
];

const TOKEN = /\{([a-z]+)\}/g;

const KNOWN_TOKENS = new Set(["slug", "collection", "year", "month", "day"]);

export function checkPermalink(pattern: string): string | undefined {
    if (!pattern.startsWith("/")) {
        return "An address starts with a slash.";
    }

    const used = new Set<string>();

    for (const [, token] of pattern.matchAll(TOKEN)) {
        if (token === undefined) {
            continue;
        }

        if (!KNOWN_TOKENS.has(token)) {
            return `There is nothing called {${token}}. Use ${[...KNOWN_TOKENS].map(name => `{${name}}`).join(", ")}.`;
        }

        used.add(token);
    }

    // Without it every entry in the collection would share one address.
    if (!used.has("slug")) {
        return "The address must include {slug}, or every entry would live at the same one.";
    }

    return undefined;
}

/**
 * Dates come from when the entry went out, falling back to when it was written, so
 * a draft previewed before publication still has somewhere to live.
 */
export function buildPermalink(
    pattern: string,
    entry: { slug: string; collection: string; publishedAt?: Date | null; createdAt?: Date }
): string {
    const at = entry.publishedAt ?? entry.createdAt ?? new Date();

    const values: Record<string, string> = {
        slug: entry.slug,
        collection: entry.collection,
        year: format(at, "yyyy"),
        month: format(at, "MM"),
        day: format(at, "dd")
    };

    return pattern.replace(TOKEN, (whole, token: string) => values[token] ?? whole);
}

/**
 * One setting per collection, so a site can address its news differently from its
 * documentation. Declared from the model because the collections are not known
 * until a site declares them.
 */
export function permalinkSettings(collections: readonly Collection[]): SettingCatalogue {
    const catalogue: SettingCatalogue = {};

    for (const collection of collections) {
        catalogue[`permalink.${collection.name}`] = {
            kind: "text",
            label: `${collection.plural} address`,
            description: `Tokens: ${[...KNOWN_TOKENS].map(name => `{${name}}`).join(", ")}`,
            default: "/{slug}",
            preview: "address",
            suggestions: PERMALINK_PATTERNS,
            check: checkPermalink
        };
    }

    return catalogue;
}

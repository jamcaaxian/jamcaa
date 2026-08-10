import { format } from "date-fns";
import type { Collection } from "./collection";
import type { SettingCatalogue, SettingDeclaration } from "../settings/definitions";

export const PERMALINK_PATTERNS = [
    "/{slug}",
    "/{collection}/{slug}",
    "/{year}/{month}/{slug}",
    "/{year}/{month}/{day}/{slug}"
];

const TOKEN = /\{([a-z]+)\}/g;

const KNOWN_TOKENS = new Set(["slug", "collection", "year", "month", "day"]);

export interface PermalinkEntry {
    slug: string;
    collection: string;
    publishedAt?: Date | null;
    createdAt?: Date;
}

export interface PermalinkMatch {
    slug: string;
}

interface PermalinkSegment {
    literal?: string;
    token?: string;
}

function segments(pattern: string): PermalinkSegment[] {
    return pattern
        .slice(1)
        .split("/")
        .map(segment => {
            const match = /^\{([a-z]+)\}$/.exec(segment);

            return match?.[1] === undefined ? { literal: segment } : { token: match[1] };
        });
}

export function checkPermalink(pattern: string): string | undefined {
    if (!pattern.startsWith("/")) {
        return "An address starts with a slash.";
    }

    if (pattern === "/" || pattern.endsWith("/") || pattern.includes("//")) {
        return "An address is made of non-empty path segments.";
    }

    if (pattern.includes("?") || pattern.includes("#")) {
        return "An address pattern cannot contain a query string or fragment.";
    }

    const used = new Set<string>();

    for (const segment of segments(pattern)) {
        if (segment.literal !== undefined && (segment.literal.includes("{") || segment.literal.includes("}"))) {
            return "A token has to occupy a complete path segment, such as /{year}/{slug}.";
        }
    }

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
export function buildPermalink(pattern: string, entry: PermalinkEntry): string {
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
 * Resolves an incoming path through the same configured pattern that builds links.
 * The caller loads the Entry by the returned slug, then supplies it here so date
 * and Collection tokens are verified against the canonical address as well.
 */
export function matchPermalink(pattern: string, path: string, entry?: PermalinkEntry): PermalinkMatch | undefined {
    if (checkPermalink(pattern) !== undefined) {
        return undefined;
    }

    const pathSegments = path.replace(/^\/+|\/+$/g, "").split("/");
    const patternSegments = segments(pattern);

    if (pathSegments.length !== patternSegments.length) {
        return undefined;
    }

    const matched: Record<string, string> = {};

    for (const [index, segment] of patternSegments.entries()) {
        const value = pathSegments[index];

        if (value === undefined || value === "") {
            return undefined;
        }

        if (segment.literal !== undefined) {
            if (value !== segment.literal) {
                return undefined;
            }

            continue;
        }

        if (segment.token !== undefined) {
            matched[segment.token] = value;
        }
    }

    const slug = matched.slug;

    if (slug === undefined) {
        return undefined;
    }

    if (entry !== undefined && buildPermalink(pattern, entry) !== `/${pathSegments.join("/")}`) {
        return undefined;
    }

    return { slug };
}

/**
 * One setting per collection, so a site can address its news differently from its
 * documentation. Declared from the model because the collections are not known
 * until a site declares them.
 */
export function permalinkSettings<const TCollections extends readonly Collection[]>(
    collections: TCollections
): Record<`permalink.${TCollections[number]["name"]}`, Extract<SettingDeclaration, { kind: "text" }>> {
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

    return catalogue as Record<
        `permalink.${TCollections[number]["name"]}`,
        Extract<SettingDeclaration, { kind: "text" }>
    >;
}

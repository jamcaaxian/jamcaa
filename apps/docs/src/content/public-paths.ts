import { buildPermalink, checkPermalink, matchPermalink } from "@jamcaa/core/content";
import type { RichTextDocument } from "@jamcaa/core/content";

const RESERVED_PATH_PREFIXES = new Set([
    "_next",
    "admin",
    "api",
    "category",
    "feed.json",
    "login",
    "media",
    "search",
    "setup",
    "tag"
]);
const RESERVED_EXACT_PATHS = new Set(["/favicon.svg", "/file.svg", "/globe.svg", "/next.svg", "/window.svg"]);

export interface AddressablePost {
    slug: string;
    status: string;
    title: string;
    excerpt: string | null;
    body: RichTextDocument;
    publishedAt: Date | null;
    createdAt: Date;
}

export function isReservedPublicAddress(address: string): boolean {
    if (RESERVED_EXACT_PATHS.has(address.toLowerCase())) {
        return true;
    }

    const first = address.replace(/^\/+/, "").split("/")[0]?.toLowerCase();

    return first !== undefined && RESERVED_PATH_PREFIXES.has(first);
}

export function checkPublicPermalink(pattern: string): string | undefined {
    const problem = checkPermalink(pattern);

    if (problem !== undefined) {
        return problem;
    }

    const first = pattern.replace(/^\/+/, "").split("/")[0]?.toLowerCase();

    if (first !== undefined && RESERVED_PATH_PREFIXES.has(first)) {
        return `The address cannot start with /${first}; that path belongs to the Site itself.`;
    }

    return undefined;
}

export function postAddress(pattern: string, entry: Pick<AddressablePost, "slug" | "publishedAt" | "createdAt">) {
    return buildPermalink(pattern, { ...entry, collection: "post" });
}

export async function freePublicPostSlug(options: {
    wanted: string;
    pattern: string;
    publishedAt: Date | null;
    createdAt: Date;
    isTaken: (slug: string) => Promise<boolean>;
}): Promise<string> {
    const { wanted, pattern, publishedAt, createdAt, isTaken } = options;

    for (let suffix = 1; suffix <= 10_000; suffix += 1) {
        const slug = suffix === 1 ? wanted : `${wanted}-${suffix}`;
        const address = postAddress(pattern, { slug, publishedAt, createdAt });

        if (!isReservedPublicAddress(address) && !(await isTaken(slug))) {
            return slug;
        }
    }

    throw new Error(`Could not find a public address for "${wanted}".`);
}

export async function resolvePublishedPost<TPost extends AddressablePost>(options: {
    pattern: string;
    pathSegments: string[];
    bySlug: (slug: string) => Promise<TPost | undefined>;
}): Promise<TPost | undefined> {
    const { pattern, pathSegments, bySlug } = options;
    const path = `/${pathSegments.join("/")}`;

    if (isReservedPublicAddress(path)) {
        return undefined;
    }

    const match = matchPermalink(pattern, path);

    if (match === undefined) {
        return undefined;
    }

    const entry = await bySlug(match.slug);

    if (
        entry?.status !== "published"
        || matchPermalink(pattern, path, { ...entry, collection: "post" }) === undefined
    ) {
        return undefined;
    }

    return entry;
}

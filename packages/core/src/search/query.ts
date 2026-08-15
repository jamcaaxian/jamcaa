import { canonicalLocale } from "../i18n";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface SearchCursor {
    rank: number;
    rowId: number;
    locale?: string;
}

function cursorProblem(): never {
    throw new Error("The search cursor is invalid.");
}

function base64Url(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
        cursorProblem();
    }

    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));

    try {
        return new TextDecoder().decode(bytes);
    } catch {
        cursorProblem();
    }
}

export function literalSearchQuery(query: string): string | undefined {
    const phrases = (query.match(/[\p{L}\p{N}\p{Co}]+/gu) ?? []).map(segment => `"${segment}"`);

    return phrases.length > 0 ? phrases.join(" ") : undefined;
}

export function searchLimit(limit: number | undefined): number {
    if (limit === undefined) {
        return DEFAULT_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error(`Search result limit must be an integer from 1 to ${MAX_LIMIT}.`);
    }

    return limit;
}

export function encodeSearchCursor(cursor: SearchCursor): string {
    if (!Number.isFinite(cursor.rank) || !Number.isSafeInteger(cursor.rowId) || cursor.rowId < 1) {
        cursorProblem();
    }

    return base64Url(
        JSON.stringify(
            cursor.locale === undefined ?
                { v: 1, r: cursor.rank, i: cursor.rowId }
            :   { v: 2, r: cursor.rank, i: cursor.rowId, l: canonicalLocale(cursor.locale) }
        )
    );
}

export function decodeSearchCursor(cursor: string | undefined): SearchCursor | undefined {
    if (cursor === undefined) {
        return undefined;
    }

    try {
        const value = JSON.parse(fromBase64Url(cursor)) as Record<string, unknown>;

        if (
            ![1, 2].includes(value.v as number)
            || typeof value.r !== "number"
            || !Number.isFinite(value.r)
            || typeof value.i !== "number"
            || !Number.isSafeInteger(value.i)
            || value.i < 1
            || (value.v === 2 && typeof value.l !== "string")
        ) {
            cursorProblem();
        }

        return {
            rank: value.r,
            rowId: value.i,
            ...(value.v === 2 ? { locale: canonicalLocale(value.l as string) } : {})
        };
    } catch (error) {
        if (error instanceof Error && error.message === "The search cursor is invalid.") {
            throw error;
        }

        cursorProblem();
    }
}

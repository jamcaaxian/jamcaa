import type { Collection } from "../content/collection";

export interface SearchFilters {
    categoryId?: string;
    tagId?: string;
}

export interface SearchRequest {
    collection: Collection;
    query: string;
    /** Canonical BCP 47 Locale. Omit only for deliberately cross-language Search. */
    locale?: string;
    filters?: SearchFilters;
    limit?: number;
    cursor?: string;
}

export interface SearchMatch {
    entryId: string;
    excerpt: string;
}

export interface SearchPage {
    matches: SearchMatch[];
    nextCursor?: string;
}

export interface SearchPort {
    search(request: SearchRequest): Promise<SearchPage>;
}

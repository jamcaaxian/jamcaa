export interface PublicPostListItem {
    id: string;
    address: string;
    title: string;
    excerpt: string | null;
    published: { dateTime: string; label: string };
}

export interface PublicPostListingNext {
    pageAddress: string;
    dataAddress: string;
}

export interface PublicPostListingPage {
    pageAddress: string;
    items: PublicPostListItem[];
    next: PublicPostListingNext | null;
}

function record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function postListItem(value: unknown): PublicPostListItem | undefined {
    const candidate = record(value);
    const published = record(candidate?.published);

    if (
        typeof candidate?.id !== "string"
        || typeof candidate.address !== "string"
        || typeof candidate.title !== "string"
        || (typeof candidate.excerpt !== "string" && candidate.excerpt !== null)
        || typeof published?.dateTime !== "string"
        || typeof published.label !== "string"
    ) {
        return undefined;
    }

    return {
        id: candidate.id,
        address: candidate.address,
        title: candidate.title,
        excerpt: candidate.excerpt,
        published: { dateTime: published.dateTime, label: published.label }
    };
}

function nextPage(value: unknown): PublicPostListingNext | null | undefined {
    if (value === null) {
        return null;
    }

    const candidate = record(value);

    return typeof candidate?.pageAddress === "string" && typeof candidate.dataAddress === "string" ?
            { pageAddress: candidate.pageAddress, dataAddress: candidate.dataAddress }
        :   undefined;
}

/** Refuse a partial or malformed network response before it enters list state. */
export function publicPostListingPageFrom(value: unknown): PublicPostListingPage | undefined {
    const candidate = record(value);

    if (typeof candidate?.pageAddress !== "string" || !Array.isArray(candidate.items)) {
        return undefined;
    }

    const items = candidate.items.map(postListItem);
    const next = nextPage(candidate.next);

    if (items.some(item => item === undefined) || next === undefined) {
        return undefined;
    }

    return { pageAddress: candidate.pageAddress, items: items as PublicPostListItem[], next };
}

export interface PublicPostListingState {
    items: PublicPostListItem[];
    next: PublicPostListingNext | null;
    phase: "idle" | "loading" | "error" | "complete";
    announcement: string;
}

export interface PublicPostListingAnnouncements {
    loading: string;
    loaded(count: number, complete: boolean): string;
    error: string;
}

const defaultAnnouncements: PublicPostListingAnnouncements = {
    loading: "Loading the next page.",
    loaded(count, complete) {
        if (complete) {
            return count === 0 ? "All Posts loaded." : (
                    `${count} more ${count === 1 ? "Post" : "Posts"} loaded. All Posts loaded.`
                );
        }

        return `${count} more ${count === 1 ? "Post" : "Posts"} loaded.`;
    },
    error: "The next page could not load automatically. Retry or use the Next page link."
};

export function publicPostListingPageFollows(state: PublicPostListingState, page: PublicPostListingPage): boolean {
    return state.next !== null && state.next.pageAddress === page.pageAddress;
}

export function initialPublicPostListingState(page: PublicPostListingPage): PublicPostListingState {
    return {
        items: [...page.items],
        next: page.next,
        phase: page.next === null ? "complete" : "idle",
        announcement: ""
    };
}

export function beginPublicPostListingLoad(
    state: PublicPostListingState,
    announcements: PublicPostListingAnnouncements = defaultAnnouncements
): PublicPostListingState {
    return state.next === null ? state : { ...state, phase: "loading", announcement: announcements.loading };
}

export function appendPublicPostListingPage(
    state: PublicPostListingState,
    page: PublicPostListingPage,
    announcements: PublicPostListingAnnouncements = defaultAnnouncements
): PublicPostListingState {
    if (!publicPostListingPageFollows(state, page)) {
        return failPublicPostListingLoad(state, announcements);
    }

    const known = new Set(state.items.map(item => item.id));
    const additions = page.items.filter(item => !known.has(item.id));
    const count = additions.length;

    return {
        items: [...state.items, ...additions],
        next: page.next,
        phase: page.next === null ? "complete" : "idle",
        announcement: announcements.loaded(count, page.next === null)
    };
}

export function failPublicPostListingLoad(
    state: PublicPostListingState,
    announcements: PublicPostListingAnnouncements = defaultAnnouncements
): PublicPostListingState {
    return { ...state, phase: "error", announcement: announcements.error };
}

export function cancelPublicPostListingLoad(state: PublicPostListingState): PublicPostListingState {
    return state.phase === "loading" ?
            { ...state, phase: state.next === null ? "complete" : "idle", announcement: "" }
        :   state;
}

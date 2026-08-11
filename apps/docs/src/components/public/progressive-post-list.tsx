"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NextPageLink } from "@/components/public/next-page-link";
import { PostList } from "@/components/public/post-list";
import {
    appendPublicPostListingPage,
    beginPublicPostListingLoad,
    cancelPublicPostListingLoad,
    failPublicPostListingLoad,
    initialPublicPostListingState,
    publicPostListingPageFollows,
    publicPostListingPageFrom,
    type PublicPostListingPage
} from "@/content/public-listing-protocol";

interface ActiveRequest {
    controller: AbortController;
    address: string;
}

export function ProgressivePostList({
    initialPage,
    emptyMessage
}: {
    initialPage: PublicPostListingPage;
    emptyMessage: string;
}) {
    const [state, setState] = useState(() => initialPublicPostListingState(initialPage));
    const [automaticLoadingPaused, setAutomaticLoadingPaused] = useState(false);
    const [retryControlVisible, setRetryControlVisible] = useState(false);
    const sentinel = useRef<HTMLDivElement>(null);
    const activeRequest = useRef<ActiveRequest | null>(null);

    const loadNextPage = useCallback(async () => {
        const next = state.next;

        if (next === null || activeRequest.current !== null) {
            return;
        }

        const request = { controller: new AbortController(), address: next.dataAddress };
        activeRequest.current = request;
        setState(beginPublicPostListingLoad);

        try {
            const response = await fetch(request.address, {
                headers: { accept: "application/json" },
                cache: "no-store",
                signal: request.controller.signal
            });

            if (!response.ok) {
                throw new Error(`The next page request returned ${response.status}.`);
            }

            const page = publicPostListingPageFrom(await response.json().catch(() => undefined));

            if (page === undefined) {
                throw new Error("The next page response is invalid.");
            }

            if (
                activeRequest.current !== request
                || request.controller.signal.aborted
                || !publicPostListingPageFollows(state, page)
            ) {
                if (activeRequest.current === request && !request.controller.signal.aborted) {
                    throw new Error("The next page response does not match the requested page.");
                }

                return;
            }

            setState(current => appendPublicPostListingPage(current, page));
            window.history.replaceState(null, "", page.pageAddress);
        } catch {
            if (activeRequest.current !== request || request.controller.signal.aborted) {
                return;
            }

            setState(failPublicPostListingLoad);
        } finally {
            if (activeRequest.current === request) {
                activeRequest.current = null;
            }
        }
    }, [state]);

    useEffect(() => {
        if (
            automaticLoadingPaused
            || state.phase !== "idle"
            || state.next === null
            || sentinel.current === null
            || typeof IntersectionObserver === "undefined"
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    void loadNextPage();
                }
            },
            { rootMargin: "0px 0px 256px 0px" }
        );

        observer.observe(sentinel.current);

        return () => observer.disconnect();
    }, [automaticLoadingPaused, loadNextPage, state.next, state.phase]);

    useEffect(
        () => () => {
            activeRequest.current?.controller.abort();
        },
        []
    );

    function pauseAutomaticLoading() {
        setAutomaticLoadingPaused(true);

        if (activeRequest.current !== null) {
            activeRequest.current.controller.abort();
            activeRequest.current = null;
            setState(cancelPublicPostListingLoad);
        }
    }

    function retryNextPage() {
        if (state.phase !== "error") {
            return;
        }

        setAutomaticLoadingPaused(true);
        setRetryControlVisible(true);
        void loadNextPage();
    }

    function leaveRetryControl() {
        setRetryControlVisible(false);
        setAutomaticLoadingPaused(false);
    }

    const retryControlActive = state.phase === "error" || state.phase === "loading";

    return (
        <>
            <section aria-busy={state.phase === "loading"}>
                <PostList entries={state.items} emptyMessage={emptyMessage} />
                <div ref={sentinel} aria-hidden="true" className="h-px" />

                {(state.next !== null || retryControlVisible) && (
                    <div className="mt-10 flex flex-wrap items-center gap-3">
                        {state.next !== null && (
                            <NextPageLink
                                href={state.next.pageAddress}
                                onFocus={pauseAutomaticLoading}
                                onBlur={() => setAutomaticLoadingPaused(false)}
                            />
                        )}
                        {state.phase === "loading" && <p className="text-muted-foreground text-sm">Loading…</p>}
                        {(state.phase === "error" || retryControlVisible) && (
                            <div className="flex flex-wrap items-center gap-3">
                                {state.phase === "error" && (
                                    <p className="text-destructive text-sm">
                                        The next page could not load automatically.
                                    </p>
                                )}
                                <button
                                    type="button"
                                    aria-disabled={!retryControlActive}
                                    onClick={retryNextPage}
                                    onBlur={leaveRetryControl}
                                    className="bg-secondary text-secondary-foreground h-11 rounded-lg px-5 text-sm font-semibold"
                                >
                                    {state.phase === "loading" ?
                                        "Retrying…"
                                    : state.phase === "error" ?
                                        "Retry"
                                    :   "Page loaded"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {state.next === null && state.items.length > 0 && (
                    <p className="text-muted-foreground mt-10 text-sm">All Posts loaded.</p>
                )}
            </section>

            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {state.announcement}
            </p>
        </>
    );
}

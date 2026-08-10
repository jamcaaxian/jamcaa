import * as React from "react";

const MOBILE_BREAKPOINT = 1024;

function subscribe(onChange: () => void) {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

export function useIsMobile() {
    // The viewport is an external store, so React subscribes to it rather than
    // mirroring it into state. The server has no viewport and assumes desktop.
    return React.useSyncExternalStore(
        subscribe,
        () => window.innerWidth < MOBILE_BREAKPOINT,
        () => false
    );
}

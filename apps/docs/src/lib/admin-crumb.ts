// The breadcrumb is rendered by the admin layout, above whichever page is open, so
// a page that knows a better name for itself publishes it here. Client-only: the
// server snapshot is always empty.
let label: string | null = null;

const listeners = new Set<() => void>();

export function setAdminCrumb(next: string | null) {
    if (label === next) {
        return;
    }

    label = next;

    for (const listener of listeners) {
        listener();
    }
}

export function subscribeToAdminCrumb(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function readAdminCrumb() {
    return label;
}

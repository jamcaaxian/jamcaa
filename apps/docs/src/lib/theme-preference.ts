// The theme lives in localStorage, which is an external store. Components read
// it through useSyncExternalStore so React never has to mirror it into state.
// The key is duplicated in the pre-paint inline script, which cannot import.
const STORAGE_KEY = "jamcaa-theme";

export type ThemePreference = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

export function subscribeToThemePreference(listener: () => void) {
    listeners.add(listener);
    // Another tab changing the theme should be reflected here too.
    window.addEventListener("storage", notify);

    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", notify);
    };
}

export function readThemePreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
        }
    } catch {
        // Storage can be unavailable in private modes.
    }

    return "system";
}

export function writeThemePreference(preference: ThemePreference) {
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    } catch {
        // A theme that cannot be remembered should still apply for this visit.
    }

    const dark =
        preference === "dark" ||
        (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    notify();
}

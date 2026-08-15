import type { LocaleAddresses } from "@/content/locales";

let addresses: LocaleAddresses | null = null;

const listeners = new Set<() => void>();

export function setPublicLocaleAddresses(next: LocaleAddresses | null) {
    addresses = next;

    for (const listener of listeners) {
        listener();
    }
}

export function subscribeToPublicLocaleAddresses(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function readPublicLocaleAddresses() {
    return addresses;
}

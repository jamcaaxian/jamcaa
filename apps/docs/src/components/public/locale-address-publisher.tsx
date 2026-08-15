"use client";

import { useEffect } from "react";
import type { LocaleAddresses } from "@/content/locales";
import { setPublicLocaleAddresses } from "@/lib/public-locale-addresses";

export function LocaleAddressPublisher({ addresses }: { addresses: LocaleAddresses }) {
    useEffect(() => {
        setPublicLocaleAddresses(addresses);

        return () => setPublicLocaleAddresses(null);
    }, [addresses]);

    return null;
}

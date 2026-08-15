"use client";

import { createContext, useContext } from "react";
import { adminCopy, type AdminCopy } from "@/content/admin-copy";
import type { DocsLocale } from "@/content/locales";

const AdminI18nContext = createContext<{ locale: DocsLocale; copy: AdminCopy } | undefined>(undefined);

export function AdminI18nProvider({ locale, children }: { locale: DocsLocale; children: React.ReactNode }) {
    return (
        <AdminI18nContext.Provider value={{ locale, copy: adminCopy(locale) }}>{children}</AdminI18nContext.Provider>
    );
}

export function useAdminI18n() {
    const context = useContext(AdminI18nContext);

    if (context === undefined) {
        throw new Error("Admin interface copy needs an AdminI18nProvider.");
    }

    return context;
}

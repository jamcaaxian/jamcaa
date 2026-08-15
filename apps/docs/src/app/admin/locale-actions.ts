"use server";

import { cookies } from "next/headers";
import { adminMessages } from "@/content/admin-locale";
import { docsLocales } from "@/content/locales";
import { UI_LOCALE_COOKIE } from "@/content/ui-locale";

export async function setUiLocale(value: string) {
    const locale = docsLocales.canonical(value);

    if (locale === undefined) {
        const { copy } = await adminMessages();
        throw new Error(copy.shell.locale.unsupported);
    }

    const cookieStore = await cookies();
    cookieStore.set(UI_LOCALE_COOKIE, locale, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365
    });
}

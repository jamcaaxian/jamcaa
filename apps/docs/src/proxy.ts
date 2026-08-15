import { NextResponse, type NextRequest } from "next/server";
import { docsLocales, localizedPath } from "@/content/locales";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/content/ui-locale";

const APPLICATION_PREFIXES = new Set(["_next", "admin", "api", "login", "media", "preview", "setup"]);
const PUBLIC_ROOT_FILES = new Set(["favicon.svg", "robots.txt", "sitemap.xml"]);

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const firstSegment = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    const routedLocale = docsLocales.fromUrlKey(firstSegment);

    if (routedLocale !== undefined) {
        const canonicalKey = docsLocales.urlKey(routedLocale);

        if (firstSegment !== canonicalKey) {
            const target = request.nextUrl.clone();
            target.pathname = `/${canonicalKey}${pathname.slice(firstSegment.length + 1)}`;

            return NextResponse.redirect(target, 308);
        }
    }

    if (
        pathname !== "/"
        && routedLocale === undefined
        && !APPLICATION_PREFIXES.has(firstSegment)
        && !PUBLIC_ROOT_FILES.has(firstSegment)
    ) {
        const target = request.nextUrl.clone();
        target.pathname = localizedPath(docsLocales.defaultLocale, pathname);

        return NextResponse.redirect(target, 308);
    }

    const locale = resolveUiLocale({
        routedLocale,
        cookieLocale: request.cookies.get(UI_LOCALE_COOKIE)?.value,
        acceptLanguage: request.headers.get("accept-language")
    });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-jamcaa-locale", locale);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("content-language", locale);

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};

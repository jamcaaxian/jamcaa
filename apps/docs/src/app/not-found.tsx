import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { docsLocales, localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { canAccessConsole } from "@/lib/console-access";

export default async function NotFound() {
    const requestHeaders = await headers();
    const locale = docsLocales.canonical(requestHeaders.get("x-jamcaa-locale") ?? "") ?? docsLocales.defaultLocale;
    const copy = publicCopy(locale);
    const showConsole = await canAccessConsole();

    return (
        <main id="main-content" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
            <p className="text-primary text-sm font-semibold">404</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {copy.notFoundTitle}
            </h1>
            <p className="text-muted-foreground mt-4 leading-7 text-pretty">{copy.notFoundDescription}</p>
            <div className="mt-8 flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href={localizedPath(locale)} />}>
                    {copy.goHome}
                </Button>
                {showConsole ?
                    <Button variant="outline" nativeButton={false} render={<Link href="/admin" />}>
                        {copy.dashboard}
                    </Button>
                :   null}
            </div>
        </main>
    );
}

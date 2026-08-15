import Link from "next/link";
import type { DocsLocale } from "@/content/locales";
import { localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";

export function DocsSiteFooter({ locale }: { locale: DocsLocale }) {
    const messages = publicCopy(locale);

    return (
        <footer className="border-border/70 border-t">
            <div className="text-muted-foreground mx-auto flex max-w-384 flex-col gap-6 px-4 py-10 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                <p>{messages.builtWithJamcaa}</p>
                <nav aria-label={messages.navigationLabel} className="flex flex-wrap gap-x-5 gap-y-2">
                    <Link className="hover:text-foreground" href={localizedPath(locale, "/docs")}>
                        {messages.docs}
                    </Link>
                    <Link className="hover:text-foreground" href={localizedPath(locale, "/reference")}>
                        {messages.reference}
                    </Link>
                    <Link className="hover:text-foreground" href={localizedPath(locale, "/feed.json")}>
                        JSON Feed
                    </Link>
                    <Link className="hover:text-foreground" href="/admin">
                        {messages.dashboard}
                    </Link>
                </nav>
            </div>
        </footer>
    );
}

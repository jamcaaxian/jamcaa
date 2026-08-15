"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { localizedPath, type DocsLocale } from "@/content/locales";
import { docsTopNavigation } from "@/content/docs-navigation";
import { publicCopy } from "@/content/public-copy";
import { cn } from "@/lib/utils";
import { LocaleMenu } from "./locale-menu";

function JamcaaMark() {
    return (
        <span className="bg-foreground text-background grid size-7 place-items-center rounded-lg font-mono text-xs font-bold shadow-inset">
            J
        </span>
    );
}

export function DocsSiteHeader({ locale, showConsole }: { locale: DocsLocale; showConsole: boolean }) {
    const pathname = usePathname();
    const messages = publicCopy(locale);
    const items = docsTopNavigation(locale);

    return (
        <header className="border-border/70 bg-background/82 sticky top-0 z-40 border-b backdrop-blur-xl supports-backdrop-filter:bg-background/72">
            <div className="mx-auto flex h-14 max-w-384 items-center gap-3 px-4 sm:px-6 lg:px-8">
                <Link
                    href={localizedPath(locale)}
                    className="focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-3"
                >
                    <JamcaaMark />
                    <span>Jamcaa</span>
                    <span className="text-muted-foreground hidden text-sm font-medium sm:inline">Docs</span>
                </Link>

                <nav aria-label={messages.navigationLabel} className="ml-5 hidden h-full items-center gap-1 lg:flex">
                    {items.map(item => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "hover:text-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-3",
                                    active ? "bg-accent text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex items-center gap-1">
                    <Link
                        href={localizedPath(locale, "/search")}
                        className="hover:bg-muted focus-visible:ring-ring grid size-9 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-3"
                    >
                        <Search className="size-4" />
                        <span className="sr-only">{messages.search}</span>
                    </Link>
                    <LocaleMenu locale={locale} label={messages.switchLanguage} />
                    <ThemeToggle labels={messages.theme} />
                    {showConsole ?
                        <Link
                            href="/admin"
                            className="border-border bg-background hover:bg-muted focus-visible:ring-ring ml-1 hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none transition-[background-color,transform] focus-visible:ring-3 active:scale-[0.97] sm:inline-flex"
                        >
                            {messages.dashboard}
                            <ArrowUpRight className="size-4" />
                        </Link>
                    :   null}

                    <Sheet>
                        <SheetTrigger
                            render={
                                <Button variant="ghost" size="icon" className="ml-1 size-9 lg:hidden">
                                    <Menu />
                                    <span className="sr-only">{messages.openMenu}</span>
                                </Button>
                            }
                        />
                        <SheetContent side="right" showCloseButton={false} className="w-[min(92vw,24rem)] gap-0">
                            <SheetHeader className="border-b px-5 py-4">
                                <div className="flex items-center justify-between gap-4">
                                    <SheetTitle className="flex items-center gap-2">
                                        <JamcaaMark />
                                        Jamcaa Docs
                                    </SheetTitle>
                                    <SheetClose
                                        render={<Button variant="ghost" size="sm" aria-label={messages.closeMenu} />}
                                    >
                                        {messages.closeMenu}
                                    </SheetClose>
                                </div>
                            </SheetHeader>
                            <nav aria-label={messages.navigationLabel} className="grid gap-1 p-4">
                                {items.map(item => (
                                    <SheetClose key={item.href} render={<Link href={item.href} />} nativeButton={false}>
                                        <span className="hover:bg-accent flex min-h-11 items-center rounded-xl px-3 text-base font-medium">
                                            {item.label}
                                        </span>
                                    </SheetClose>
                                ))}
                                <SheetClose
                                    render={<Link href={localizedPath(locale, "/search")} />}
                                    nativeButton={false}
                                >
                                    <span className="hover:bg-accent flex min-h-11 items-center gap-2 rounded-xl px-3 text-base font-medium">
                                        <Search className="size-4" />
                                        {messages.search}
                                    </span>
                                </SheetClose>
                            </nav>
                            <div className="mt-auto grid gap-2 border-t p-4">
                                <LocaleMenu locale={locale} label={messages.switchLanguage} fullWidth />
                                {showConsole ?
                                    <SheetClose render={<Link href="/admin" />} nativeButton={false}>
                                        <span className="bg-primary text-primary-foreground flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
                                            {messages.dashboard}
                                            <ArrowUpRight className="size-4" />
                                        </span>
                                    </SheetClose>
                                :   null}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}

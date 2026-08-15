"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { docsSidebarNavigation } from "@/content/docs-navigation";
import { initialDocsSidebarOpenState, nextDocsSidebarOpenState } from "@/content/docs-sidebar-state";
import type { DocsLocale } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import type { DocsSidebarOptions } from "@/content/site-blocks";
import { cn } from "@/lib/utils";

function itemClass(active: boolean, nested = false): string {
    return cn(
        "focus-visible:ring-ring relative flex min-h-9 items-center rounded-lg border-l-2 py-1.5 pr-2 text-sm leading-5 outline-none transition-colors duration-150 focus-visible:ring-3",
        nested ? "pl-4" : "pl-3 font-medium",
        active ?
            "border-primary bg-primary/8 text-foreground"
        :   "text-muted-foreground border-transparent hover:bg-accent/55 hover:text-foreground"
    );
}

export function DocsSidebar({
    locale,
    currentAddress,
    options,
    ariaLabel
}: {
    locale: DocsLocale;
    currentAddress: string;
    options: DocsSidebarOptions;
    ariaLabel: string;
}) {
    const messages = publicCopy(locale);
    const sections = docsSidebarNavigation(locale);
    const initiallyOpen = initialDocsSidebarOpenState(sections, currentAddress, options.autoCollapse);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(initiallyOpen);

    function toggle(sectionId: string) {
        setOpenSections(current => nextDocsSidebarOpenState(sections, current, sectionId, options.autoCollapse));
    }

    return (
        <nav aria-label={ariaLabel} className="space-y-2">
            {sections.map(section => {
                const rootActive = section.root.href === currentAddress;

                if (!options.multiLevel) {
                    return (
                        <div key={section.id} className="space-y-1">
                            <Link
                                href={section.root.href}
                                aria-current={rootActive ? "page" : undefined}
                                className={itemClass(rootActive)}
                            >
                                {section.root.label}
                            </Link>
                            {section.children.map(item => {
                                const active = item.href === currentAddress;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        className={itemClass(active)}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                }

                const open = openSections[section.id] === true;

                return (
                    <div key={section.id} className="space-y-1">
                        <div className="flex items-center gap-1">
                            <Link
                                href={section.root.href}
                                aria-current={rootActive ? "page" : undefined}
                                className={cn(itemClass(rootActive), "min-w-0 flex-1")}
                            >
                                {section.root.label}
                            </Link>
                            <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={`docs-sidebar-${section.id}`}
                                aria-label={
                                    open ?
                                        messages.collapseSection(section.root.label)
                                    :   messages.expandSection(section.root.label)
                                }
                                onClick={() => toggle(section.id)}
                                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-8 shrink-0 place-items-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-3 active:scale-[0.97]"
                            >
                                <ChevronDown
                                    className={cn(
                                        "size-4 transition-transform duration-150 motion-reduce:transition-none",
                                        open ? "rotate-0" : "-rotate-90"
                                    )}
                                />
                            </button>
                        </div>
                        {open ?
                            <div
                                id={`docs-sidebar-${section.id}`}
                                className="border-border/70 ml-3 space-y-1 border-l pl-2"
                            >
                                {section.children.map(item => {
                                    const active = item.href === currentAddress;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            aria-current={active ? "page" : undefined}
                                            className={itemClass(active, true)}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        :   null}
                    </div>
                );
            })}
        </nav>
    );
}

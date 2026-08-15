"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { docsLocales, localizedPath, unlocalizedPath, type DocsLocale } from "@/content/locales";
import { readPublicLocaleAddresses, subscribeToPublicLocaleAddresses } from "@/lib/public-locale-addresses";

export function LocaleMenu({
    locale,
    label,
    fullWidth = false
}: {
    locale: DocsLocale;
    label: string;
    fullWidth?: boolean;
}) {
    const path = unlocalizedPath(usePathname());
    const addresses = useSyncExternalStore(subscribeToPublicLocaleAddresses, readPublicLocaleAddresses, () => null);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size={fullWidth ? "default" : "icon-lg"}
                        className={fullWidth ? "min-h-11 w-full justify-start gap-2 px-3" : undefined}
                    >
                        <Languages className="size-4" />
                        {fullWidth ?
                            <span>{label}</span>
                        :   <span className="sr-only">{label}</span>}
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-48">
                {docsLocales.definitions.map(definition => (
                    <DropdownMenuItem
                        key={definition.tag}
                        render={<Link href={addresses?.[definition.tag] ?? localizedPath(definition.tag, path)} />}
                        nativeButton={false}
                    >
                        <span className="min-w-0 flex-1">{definition.label}</span>
                        <span className="text-muted-foreground font-mono text-xs">{definition.tag}</span>
                        {definition.tag === locale ?
                            <Check className="size-4" />
                        :   null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { setUiLocale } from "@/app/admin/locale-actions";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { docsLocales } from "@/content/locales";
import { useAdminI18n } from "./admin-i18n";

export function AdminLocaleMenu() {
    const router = useRouter();
    const { locale, copy } = useAdminI18n();
    const [pending, startTransition] = useTransition();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
                        <Languages className="size-4" />
                        <span className="sr-only">{copy.shell.locale.choose}</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-48">
                {docsLocales.definitions.map(definition => (
                    <DropdownMenuItem
                        key={definition.tag}
                        onClick={() => {
                            if (definition.tag === locale) return;

                            startTransition(async () => {
                                await setUiLocale(definition.tag);
                                router.refresh();
                            });
                        }}
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

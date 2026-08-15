"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    readThemePreference,
    subscribeToThemePreference,
    writeThemePreference,
    type ThemePreference
} from "@/lib/theme-preference";

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle({
    labels = { light: "Light", dark: "Dark", system: "System", change: "Change theme" }
}: {
    labels?: { light: string; dark: string; system: string; change: string };
}) {
    // The server cannot know the preference, so it renders the neutral choice
    // and the real one takes over on hydration.
    const preference = useSyncExternalStore(subscribeToThemePreference, readThemePreference, () => "system" as const);

    const Icon = icons[preference];
    const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
        { value: "light", label: labels.light, icon: Sun },
        { value: "dark", label: labels.dark, icon: Moon },
        { value: "system", label: labels.system, icon: Monitor }
    ];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="ghost" size="icon" className="size-8">
                        <Icon className="size-4" />
                        <span className="sr-only">{labels.change}</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="end">
                {options.map(option => (
                    <DropdownMenuItem key={option.value} onClick={() => writeThemePreference(option.value)}>
                        <option.icon className="size-4" />
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

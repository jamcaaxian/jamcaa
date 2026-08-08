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

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor }
];

export function ThemeToggle() {
    // The server cannot know the preference, so it renders the neutral choice
    // and the real one takes over on hydration.
    const preference = useSyncExternalStore(
        subscribeToThemePreference,
        readThemePreference,
        () => "system" as const
    );

    const Icon = options.find((option) => option.value === preference)?.icon ?? Monitor;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="ghost" size="icon" className="size-8">
                        <Icon className="size-4" />
                        <span className="sr-only">Change theme</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="end">
                {options.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => writeThemePreference(option.value)}>
                        <option.icon className="size-4" />
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

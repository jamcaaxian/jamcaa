"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAccent, type AccentFormState } from "./actions";

export const ACCENT_PRESETS = [
    { name: "Ink Blue", color: "#3388FF" },
    { name: "Deep Indigo", color: "#5B5BD6" },
    { name: "Forest", color: "#3A8D5C" },
    { name: "Teal", color: "#0F766E" },
    { name: "Clay", color: "#C2571B" },
    { name: "Rose", color: "#C4456B" }
] as const;

function CustomAccentField({ current, pending }: { current: string; pending: boolean }) {
    const [value, setValue] = useState(current);

    return (
        <div className="flex max-w-sm gap-2">
            <Input
                id="custom-accent"
                name="theme.accent"
                value={value}
                onChange={event => setValue(event.target.value)}
                placeholder="#3388FF"
                className="font-mono"
            />
            <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Apply"}
            </Button>
        </div>
    );
}

export function AccentForm({ current }: { current: string }) {
    const [state, formAction, pending] = useActionState<AccentFormState, FormData>(saveAccent, {});

    return (
        <form action={formAction} className="space-y-8">
            <div className="space-y-3">
                <Label>Presets</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ACCENT_PRESETS.map(preset => (
                        <button
                            key={preset.color}
                            type="submit"
                            name="theme.accent"
                            value={preset.color}
                            className="group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 ease-spring hover:-translate-y-0.5 hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]"
                        >
                            <span
                                aria-hidden="true"
                                className="size-7 shrink-0 rounded-full"
                                style={{ backgroundColor: preset.color }}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{preset.name}</span>
                                <span className="block font-mono text-xs text-muted-foreground">{preset.color}</span>
                            </span>
                            {current.toLowerCase() === preset.color.toLowerCase() ?
                                <Check className="text-primary size-4" />
                            :   null}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <Label htmlFor="custom-accent">Custom colour</Label>
                <CustomAccentField key={current} current={current} pending={pending} />
                <p className="text-muted-foreground text-sm">
                    Any CSS colour works. Text on top of it is kept legible automatically, and the whole site updates
                    the moment it is applied.
                </p>
            </div>

            {state.error ?
                <p className="text-destructive text-sm">{state.error}</p>
            :   null}
            {state.saved ?
                <p className="text-sm">Accent applied across the site.</p>
            :   null}
        </form>
    );
}

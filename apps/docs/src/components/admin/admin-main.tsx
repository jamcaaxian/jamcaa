"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function isEditorialPath(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean);

    return segments.length === 3 && segments[0] === "admin" && (segments[1] === "posts" || segments[1] === "pages");
}

export function AdminMain({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
    const editorial = isEditorialPath(usePathname());

    return (
        <SidebarInset>
            {editorial ? null : (
                <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-xl">
                    {toolbar}
                </header>
            )}
            <div id="main-content" className={cn("min-w-0 flex-1", editorial ? "p-0" : "p-5 sm:p-8")}>
                {children}
            </div>
        </SidebarInset>
    );
}

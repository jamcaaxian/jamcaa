"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAdminI18n } from "./admin-i18n";

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function UserMenu({
    user
}: {
    user: { name: string; email: string; image?: string | null; role?: string | null };
}) {
    const { copy } = useAdminI18n();
    const role =
        user.role ? (copy.roles.roleLabels[user.role as keyof typeof copy.roles.roleLabels] ?? user.role) : null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="ghost" size="icon" className="size-8 rounded-full">
                        <Avatar className="size-8">
                            {user.image ?
                                <AvatarImage src={user.image} alt="" />
                            :   null}
                            <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="sr-only">{copy.shell.account.open}</span>
                    </Button>
                }
            />
            <DropdownMenuContent align="end" className="w-56">
                {/* Base UI requires a label to sit inside a group. */}
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                        <div className="truncate text-sm font-medium">{user.name}</div>
                        <div className="text-muted-foreground truncate text-xs">{user.email}</div>
                        {role ?
                            <div className="text-muted-foreground mt-1 text-xs">{role}</div>
                        :   null}
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <form action={signOut}>
                    {/* Signing out changes server state, so it is a submission, not a link.
                        nativeButton tells Base UI the render target is already a button. */}
                    <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
                        <LogOut className="size-4" />
                        {copy.shell.account.signOut}
                    </DropdownMenuItem>
                </form>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

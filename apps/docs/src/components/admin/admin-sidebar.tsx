"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    FileText,
    HardDrive,
    Image as ImageIcon,
    LayoutTemplate,
    Palette,
    Settings,
    ShieldCheck,
    Tags
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail
} from "@/components/ui/sidebar";
import { useAdminI18n } from "./admin-i18n";

export function AdminSidebar({ siteTitle = "jamcaa" }: { siteTitle?: string }) {
    const pathname = usePathname();
    const { copy } = useAdminI18n();
    // Content and configuration are separated because they are used in different
    // modes: writing is occasional and immersive, configuration is rare and careful.
    const sections = [
        {
            label: copy.shell.navigation.content,
            items: [
                { title: copy.shell.navigation.posts, href: "/admin/posts", icon: FileText },
                { title: copy.shell.navigation.pages, href: "/admin/pages", icon: LayoutTemplate },
                { title: copy.shell.navigation.taxonomy, href: "/admin/taxonomy", icon: Tags },
                { title: copy.shell.navigation.media, href: "/admin/media", icon: ImageIcon }
            ]
        },
        {
            label: copy.shell.navigation.configuration,
            items: [
                { title: copy.shell.navigation.design, href: "/admin/design", icon: Palette },
                { title: copy.shell.navigation.roles, href: "/admin/roles", icon: ShieldCheck },
                { title: copy.shell.navigation.storage, href: "/admin/storage", icon: HardDrive },
                { title: copy.shell.navigation.settings, href: "/admin/settings", icon: Settings }
            ]
        }
    ];

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="h-14 justify-center border-b px-4">
                <Link href="/admin" className="font-heading text-sm font-semibold tracking-tight">
                    {siteTitle}
                </Link>
            </SidebarHeader>

            <SidebarContent>
                {sections.map(section => (
                    <SidebarGroup key={section.label}>
                        <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {section.items.map(item => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            render={<Link href={item.href} />}
                                            tooltip={item.title}
                                            isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                                        >
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarRail />
        </Sidebar>
    );
}

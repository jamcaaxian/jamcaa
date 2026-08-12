"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, HardDrive, Image as ImageIcon, Settings, ShieldCheck, Tags } from "lucide-react";
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

// Content and configuration are separated because they are used in different
// modes: writing is occasional and immersive, configuration is rare and careful.
const sections = [
    {
        label: "Content",
        items: [
            { title: "Posts", href: "/admin/posts", icon: FileText },
            { title: "Taxonomy", href: "/admin/taxonomy", icon: Tags },
            { title: "Media", href: "/admin/media", icon: ImageIcon }
        ]
    },
    {
        label: "Configuration",
        items: [
            { title: "Roles", href: "/admin/roles", icon: ShieldCheck },
            { title: "Storage", href: "/admin/storage", icon: HardDrive },
            { title: "Settings", href: "/admin/settings", icon: Settings }
        ]
    }
];

export function AdminSidebar({ siteTitle = "jamcaa" }: { siteTitle?: string }) {
    const pathname = usePathname();

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

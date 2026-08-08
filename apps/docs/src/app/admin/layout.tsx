import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
                    <AdminBreadcrumb />
                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </header>

                <main className="flex-1 p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}

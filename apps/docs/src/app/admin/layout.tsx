import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireSession } from "@/lib/session";

// Every admin page reads the session, and the runtime bindings it needs only
// exist inside a request. Applies to all segments below this layout.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = await requireSession();

    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
                    <AdminBreadcrumb />
                    <div className="ml-auto flex items-center gap-1">
                        <ThemeToggle />
                        <UserMenu user={user} />
                    </div>
                </header>

                <div className="flex-1 p-6">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}

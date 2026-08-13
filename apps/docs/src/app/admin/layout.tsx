import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { ensureInstalled } from "@jamcaaxian/core/install";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { installPlan } from "@/content/install";
import { siteSettings } from "@/content/settings";
import { requireSession } from "@/lib/session";
import { getSettings } from "@jamcaaxian/core/settings";

// Every admin page reads the session, and the runtime bindings it needs only
// exist inside a request. Applies to all segments below this layout.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = await requireSession();

    // A site installed under an earlier version is brought up to date here rather
    // than by whoever deployed it remembering to run something.
    const { env } = getCloudflareContext();

    const database = createDatabase(env.DB);

    await ensureInstalled(database, installPlan);

    const settings = await getSettings(database, siteSettings);

    return (
        <SidebarProvider>
            <AdminSidebar siteTitle={settings.get("site.title")} />
            <SidebarInset>
                <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <AdminBreadcrumb />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <ThemeToggle />
                        <UserMenu user={user} />
                    </div>
                </header>

                <div id="main-content" className="min-w-0 flex-1 p-4 sm:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

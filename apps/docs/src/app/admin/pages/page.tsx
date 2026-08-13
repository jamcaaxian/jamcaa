import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { pages } from "@/content/pages-store";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to read pages.</p>;
    }

    const { env } = getCloudflareContext();
    const all = await pages(createDatabase(env.DB)).list();
    const mayManage = await may(actor, "page", "manage");

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Pages"
                description="Pages are built from components and addressed by their own path. “/” replaces the default home listing."
            >
                {mayManage ?
                    <Button nativeButton={false} render={<Link href="/admin/pages/new" />}>
                        New page
                    </Button>
                :   null}
            </AdminPageHeader>

            {all.length === 0 ?
                <div className="rounded-2xl border border-dashed px-8 py-16 text-center">
                    <p className="font-medium">No pages yet.</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {mayManage ?
                            "Create a home page, a portfolio, or anything else composed of blocks."
                        :   "Pages will appear here once they exist."}
                    </p>
                </div>
            :   <ul className="divide-border/70 divide-y">
                    {all.map(page => (
                        <li key={page.id} className="flex items-center gap-4 py-5 first:pt-0 last:pb-0">
                            <Link
                                href={mayManage ? `/admin/pages/${page.id}` : page.address}
                                className="min-w-0 flex-1 space-y-1"
                            >
                                <span className="flex items-baseline gap-3">
                                    <span className="truncate font-medium">{page.title}</span>
                                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                        {page.address}
                                    </span>
                                </span>
                                <span className="text-muted-foreground block text-xs">
                                    {page.body.blocks.length === 1 ? "One block" : `${page.body.blocks.length} blocks`}
                                </span>
                            </Link>
                            <Badge variant={page.status === "published" ? "default" : "secondary"}>{page.status}</Badge>
                        </li>
                    ))}
                </ul>
            }
        </div>
    );
}

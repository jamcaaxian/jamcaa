import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { adminMessages } from "@/content/admin-locale";
import { docsLocales, localizedPath } from "@/content/locales";
import { pages } from "@/content/pages-store";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.pages.list.title };
}

export default async function PagesPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.pages.list.permission}</p>;
    }

    const { env } = getCloudflareContext();
    const all = await pages(createDatabase(env.DB)).list();
    const mayCreate = await may(actor, "page", "create");
    const mayUpdate = await may(actor, "page", "update");

    return (
        <div className="space-y-6">
            <AdminPageHeader title={copy.pages.list.title} description={copy.pages.list.description}>
                {mayCreate ?
                    <Button nativeButton={false} render={<Link href="/admin/pages/new" />}>
                        {copy.pages.list.new}
                    </Button>
                :   null}
            </AdminPageHeader>

            {all.length === 0 ?
                <div className="rounded-2xl border border-dashed px-8 py-16 text-center">
                    <p className="font-medium">{copy.pages.list.emptyTitle}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {mayCreate ? copy.pages.list.emptyCreate : copy.pages.list.emptyWait}
                    </p>
                </div>
            :   <ul className="divide-border/70 divide-y">
                    {all.map(page => {
                        const pageLocale = docsLocales.canonical(page.locale);
                        const publicAddress =
                            pageLocale === undefined ? page.address : localizedPath(pageLocale, page.address);

                        return (
                            <li key={page.id} className="flex items-center gap-4 py-5 first:pt-0 last:pb-0">
                                <Link
                                    href={mayUpdate ? `/admin/pages/${page.id}` : publicAddress}
                                    className="min-w-0 flex-1 space-y-1"
                                >
                                    <span className="flex items-baseline gap-3">
                                        <span className="truncate font-medium">{page.title}</span>
                                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                            {publicAddress}
                                        </span>
                                    </span>
                                    <span className="text-muted-foreground block text-xs">
                                        {copy.pages.list.blocks(page.body.blocks.length)}
                                    </span>
                                </Link>
                                <Badge variant={page.status === "published" ? "default" : "secondary"}>
                                    {copy.common.status[page.status]}
                                </Badge>
                            </li>
                        );
                    })}
                </ul>
            }
        </div>
    );
}

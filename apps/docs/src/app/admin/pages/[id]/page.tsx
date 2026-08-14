import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { pages } from "@/content/pages-store";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { updatePage } from "../actions";
import { PageEditor } from "../page-editor";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "update"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to update pages.</p>;
    }

    const { id } = await params;
    const { env } = getCloudflareContext();
    const page = await pages(createDatabase(env.DB)).byId(id);

    if (page === undefined) {
        notFound();
    }

    const action = updatePage.bind(null, page.id);
    const mayPublish = await may(actor, "page", "publish");

    return (
        <div className="space-y-8">
            <AdminPageHeader title="Edit page">
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={page.address} />}>
                    View on site
                </Button>
            </AdminPageHeader>
            <PageEditor
                action={action}
                initial={{
                    id: page.id,
                    title: page.title,
                    address: page.address,
                    status: page.status,
                    blocks: page.body.blocks
                }}
                mayPublish={mayPublish}
                submitLabel="Save page"
            />
        </div>
    );
}

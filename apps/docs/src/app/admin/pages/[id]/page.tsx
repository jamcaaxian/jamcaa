import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { adminMessages } from "@/content/admin-locale";
import { docsLocales, localizedPath } from "@/content/locales";
import { pages } from "@/content/pages-store";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { updatePage } from "../actions";
import { PageEditor } from "../page-editor";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.pages.form.editTitle };
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "update"))) {
        return <p className="text-muted-foreground text-sm">{copy.pages.form.permissionUpdate}</p>;
    }

    const { id } = await params;
    const { env } = getCloudflareContext();
    const page = await pages(createDatabase(env.DB)).byId(id);

    if (page === undefined) {
        notFound();
    }

    const action = updatePage.bind(null, page.id);
    const mayPublish = await may(actor, "page", "publish");
    const pageLocale = docsLocales.canonical(page.locale);
    const publicAddress = pageLocale === undefined ? page.address : localizedPath(pageLocale, page.address);

    return (
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
            submitLabel={copy.pages.form.save}
            viewHref={publicAddress}
        />
    );
}

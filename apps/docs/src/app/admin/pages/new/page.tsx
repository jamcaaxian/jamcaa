import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { adminMessages } from "@/content/admin-locale";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { createPage } from "../actions";
import { PageEditor } from "../page-editor";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.pages.form.newTitle };
}

export default async function NewPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "create"))) {
        return <p className="text-muted-foreground text-sm">{copy.pages.form.permissionCreate}</p>;
    }

    const mayPublish = await may(actor, "page", "publish");

    return (
        <div className="space-y-8">
            <AdminPageHeader title={copy.pages.form.newTitle} description={copy.pages.form.newDescription} />
            <PageEditor
                action={createPage}
                initial={{ title: "", address: "/", status: "draft", blocks: [] }}
                mayPublish={mayPublish}
                submitLabel={copy.pages.form.create}
            />
        </div>
    );
}

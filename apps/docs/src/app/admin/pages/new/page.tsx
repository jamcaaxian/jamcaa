import type { Metadata } from "next";
import { emptyRichText } from "@jamcaaxian/core/content";
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
        <PageEditor
            action={createPage}
            initial={{
                title: "",
                address: "/",
                status: "draft",
                blocks: [{ id: "body", type: "builtin.richText", props: { document: emptyRichText() } }]
            }}
            mayPublish={mayPublish}
            submitLabel={copy.pages.form.create}
        />
    );
}

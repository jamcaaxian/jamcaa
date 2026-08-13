import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { createPage } from "../actions";
import { PageEditor } from "../page-editor";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", "manage"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to manage pages.</p>;
    }

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="New page"
                description="Start from an empty body, or add a heading and a paragraph and grow from there."
            />
            <PageEditor
                action={createPage}
                initial={{ title: "", address: "/", status: "draft", blocks: [] }}
                submitLabel="Create page"
            />
        </div>
    );
}

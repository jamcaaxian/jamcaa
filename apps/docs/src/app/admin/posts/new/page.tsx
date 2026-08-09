import type { Metadata } from "next";
import { may, mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "post", "create"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to write posts.</p>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold tracking-tight">New post</h1>
            <PostForm mayPublish={await mayTouch(actor, "post", "publish", actor.id)} />
        </div>
    );
}

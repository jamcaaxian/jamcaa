import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { posts } from "@/content/store";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { DeletePostButton } from "../delete-post-button";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    const { env } = getCloudflareContext();
    const entry = await posts(createDatabase(env.DB)).byId((await params).id);

    if (entry === undefined) {
        notFound();
    }

    if (!(await mayTouch(actor, "post", "update", entry.authorId))) {
        return <p className="text-muted-foreground text-sm">This post is not yours to edit.</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <h1 className="text-lg font-semibold tracking-tight">Edit post</h1>
                {(await mayTouch(actor, "post", "delete", entry.authorId)) ?
                    <DeletePostButton id={entry.id} title={entry.title} />
                :   null}
            </div>

            <PostForm
                post={{
                    id: entry.id,
                    title: entry.title,
                    slug: entry.slug,
                    excerpt: entry.excerpt,
                    body: entry.body,
                    status: entry.status
                }}
                mayPublish={await mayTouch(actor, "post", "publish", entry.authorId)}
            />
        </div>
    );
}

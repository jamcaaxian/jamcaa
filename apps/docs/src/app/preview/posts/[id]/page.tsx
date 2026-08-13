import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { PostContent } from "@/components/public/post-content";
import { publicMoment } from "@/content/public-site";
import { posts } from "@/content/store";
import { mayTouch } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Post preview",
    robots: { index: false, follow: false, noarchive: true, nocache: true }
};

const statusLabels = {
    draft: "Draft preview saved",
    archived: "Archived preview saved",
    published: "Published preview saved"
} as const;

export default async function PreviewPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
        redirect(`/login?next=${encodeURIComponent(`/preview/posts/${id}`)}`);
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const entry = await posts(database).byId(id);
    const actor = { id: session.user.id, role: session.user.role };

    if (entry === undefined || !(await mayTouch(actor, "post", "update", entry.authorId))) {
        notFound();
    }

    const saved = await publicMoment(entry.updatedAt);

    return (
        <PostContent
            post={entry}
            publishedLabel={saved.label}
            statusLabel={statusLabels[entry.status]}
            statusMoment={entry.updatedAt}
            backAddress={`/admin/posts/${encodeURIComponent(entry.id)}`}
            backLabel="Edit Post"
        />
    );
}

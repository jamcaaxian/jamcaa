"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { restorePostRevision } from "@/content/post-writes";
import { postRevisions, posts } from "@/content/store";
import { may, mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type RestoreRevisionState = { error?: string };

export async function restoreRevision(
    _previous: RestoreRevisionState,
    formData: FormData
): Promise<RestoreRevisionState> {
    const entryId = String(formData.get("entryId") ?? "");
    const revisionId = String(formData.get("revisionId") ?? "");
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const entry = await posts(database).byId(entryId);

    if (entry === undefined || !(await mayTouch(actor, "post", "update", entry.authorId))) {
        return { error: "That Revision is not available." };
    }

    const source = await postRevisions(database).byId(entry.id, revisionId);

    if (source === undefined) {
        return { error: "That Revision is not available." };
    }

    if (!(await may(actor, "taxonomy", "read"))) {
        return { error: "You do not have permission to assign taxonomy." };
    }

    const mayPublish = await mayTouch(actor, "post", "publish", entry.authorId);

    const sourcePublishedAt = source.snapshot.publishedAt;
    const currentPublishedAt = entry.publishedAt?.getTime() ?? null;

    if (
        !mayPublish
        && ((entry.status === "published" && source.snapshot.status !== entry.status)
            || source.snapshot.status === "published"
            || source.snapshot.slug !== entry.slug
            || sourcePublishedAt !== currentPublishedAt)
    ) {
        return { error: "You may update this Post, but not change whether it is published." };
    }

    try {
        await restorePostRevision({
            database,
            actorId: actor.id,
            mayPublish,
            entryId: entry.id,
            revisionId: source.id
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (/category no longer exists|tag.*no longer exists/i.test(message)) {
            return { error: message };
        }

        return { error: "That Revision could not be restored." };
    }

    revalidatePath("/", "layout");
    redirect(`/admin/posts/${encodeURIComponent(entry.id)}`);
}

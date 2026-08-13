"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { compareAndIncrementPublicAddressRevision, publicAddressRevision } from "@/content/public-address-revision";
import { commitPostState } from "@/content/post-writes";
import { posts, writePostWithTags } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";
import { may, mayTouch, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { readPostSubmission } from "./post-submission";

export type PostFormState = { error?: string };

async function workspace() {
    const session = await requireSession();
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const actor: Actor = { id: session.user.id, role: session.user.role };

    return { actor, database, store: posts(database) };
}

export async function savePost(_previous: PostFormState, formData: FormData): Promise<PostFormState> {
    const { actor, database, store } = await workspace();

    const submission = readPostSubmission(formData);

    if ("error" in submission) {
        return submission;
    }

    const { id, title, excerpt, body, status, categoryId, tagIds } = submission;
    const existing = id ? await store.byId(id) : undefined;

    if (id && existing === undefined) {
        return { error: "That post no longer exists." };
    }

    const owner = existing?.authorId ?? actor.id;

    const allowed = existing ? await mayTouch(actor, "post", "update", owner) : await may(actor, "post", "create");

    if (!allowed) {
        return { error: "You do not have permission to write this post." };
    }

    if (!(await may(actor, "taxonomy", "read"))) {
        return { error: "You do not have permission to assign taxonomy." };
    }

    const terms = taxonomy(database);

    if ((await terms.categoryById(categoryId)) === undefined) {
        return { error: "The selected category no longer exists." };
    }

    for (const tagId of new Set(tagIds)) {
        if ((await terms.tagById(tagId)) === undefined) {
            return { error: "One of the selected tags no longer exists." };
        }
    }

    const mayPublish = await mayTouch(actor, "post", "publish", owner);
    const requestsPublished = status === "published";
    const takesPublishedOffline = existing?.status === "published" && status !== "published";

    // Checked on the server because the form only hides what it must not offer.
    if (!mayPublish && (requestsPublished || takesPublishedOffline)) {
        return { error: "You may write this post, but not change whether it is published." };
    }

    await commitPostState({
        database,
        actorId: actor.id,
        mayPublish,
        desired: { id: existing?.id, title, excerpt, body, status, slug: submission.slug, categoryId, tagIds }
    });

    revalidatePath("/", "layout");
    redirect("/admin/posts");
}

export async function deletePost(formData: FormData): Promise<void> {
    const { actor, database, store } = await workspace();
    const id = String(formData.get("id") ?? "");
    const existing = await store.byId(id);

    if (existing === undefined) {
        redirect("/admin/posts");
    }

    if (!(await mayTouch(actor, "post", "delete", existing.authorId))) {
        throw new Error("You do not have permission to delete this post.");
    }

    const expectedAddressRevision = await publicAddressRevision(database);

    await writePostWithTags(
        database,
        [],
        async () => {
            const current = await store.byId(id);

            if (current === undefined) {
                return { entry: id, statements: [] };
            }

            return {
                entry: id,
                statements: [
                    database.$client
                        .prepare(
                            "UPDATE post SET category_id = CASE WHEN updated_at = ? THEN category_id ELSE NULL END "
                                + "WHERE id = ?"
                        )
                        .bind(current.updatedAt.getTime(), id),
                    database.$client.prepare("DELETE FROM post WHERE id = ?").bind(id),
                    ...compareAndIncrementPublicAddressRevision(database, expectedAddressRevision)
                ]
            };
        },
        postId => postId
    );

    revalidatePath("/", "layout");
    redirect("/admin/posts");
}

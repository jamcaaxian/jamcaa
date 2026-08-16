"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { adminMessages } from "@/content/admin-locale";
import { compareAndIncrementPublicAddressRevision, publicAddressRevision } from "@/content/public-address-revision";
import { commitPostState } from "@/content/post-writes";
import { posts, writePostWithTags } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";
import { may, mayTouch, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { readPostSubmission } from "./post-submission";

export type PostFormState = { error?: string; saved?: boolean };

async function workspace() {
    const session = await requireSession();
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const actor: Actor = { id: session.user.id, role: session.user.role };

    return { actor, database, store: posts(database) };
}

export async function savePost(_previous: PostFormState, formData: FormData): Promise<PostFormState> {
    const { copy } = await adminMessages();
    const { actor, database, store } = await workspace();

    const submission = readPostSubmission(formData, copy.posts.errors);

    if ("error" in submission) {
        return submission;
    }

    const { id, title, excerpt, body, status, categoryId, tagIds } = submission;
    const existing = id ? await store.byId(id) : undefined;

    if (id && existing === undefined) {
        return { error: copy.posts.errors.missing };
    }

    const owner = existing?.authorId ?? actor.id;

    const allowed = existing ? await mayTouch(actor, "post", "update", owner) : await may(actor, "post", "create");

    if (!allowed) {
        return { error: copy.posts.errors.writeDenied };
    }

    if (!(await may(actor, "taxonomy", "read"))) {
        return { error: copy.posts.errors.taxonomyDenied };
    }

    const terms = taxonomy(database);

    if ((await terms.categoryById(categoryId)) === undefined) {
        return { error: copy.posts.errors.categoryMissing };
    }

    for (const tagId of new Set(tagIds)) {
        if ((await terms.tagById(tagId)) === undefined) {
            return { error: copy.posts.errors.tagMissing };
        }
    }

    const mayPublish = await mayTouch(actor, "post", "publish", owner);
    const requestsPublished = status === "published";
    const takesPublishedOffline = existing?.status === "published" && status !== "published";

    // Checked on the server because the form only hides what it must not offer.
    if (!mayPublish && (requestsPublished || takesPublishedOffline)) {
        return { error: copy.posts.errors.publishDenied };
    }

    const stored = await commitPostState({
        database,
        actorId: actor.id,
        mayPublish,
        desired: { id: existing?.id, title, excerpt, body, status, slug: submission.slug, categoryId, tagIds }
    });

    revalidatePath("/", "layout");

    if (existing === undefined) {
        redirect(`/admin/posts/${encodeURIComponent(stored.id)}`);
    }

    return { saved: true };
}

export async function deletePost(formData: FormData): Promise<void> {
    const { copy } = await adminMessages();
    const { actor, database, store } = await workspace();
    const id = String(formData.get("id") ?? "");
    const existing = await store.byId(id);

    if (existing === undefined) {
        redirect("/admin/posts");
    }

    if (!(await mayTouch(actor, "post", "delete", existing.authorId))) {
        throw new Error(copy.posts.errors.deleteDenied);
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

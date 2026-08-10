"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { freeSlug, toSlug } from "@jamcaa/core/content";
import { posts } from "@/content/store";
import { may, mayTouch, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { readPostSubmission } from "./post-submission";

export type PostFormState = { error?: string };

async function workspace() {
    const session = await requireSession();
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const actor: Actor = { id: session.user.id, role: session.user.role };

    return { actor, store: posts(database) };
}

export async function savePost(_previous: PostFormState, formData: FormData): Promise<PostFormState> {
    const { actor, store } = await workspace();

    const submission = readPostSubmission(formData);

    if ("error" in submission) {
        return submission;
    }

    const { id, title, excerpt, body, status } = submission;
    const wantedSlug = toSlug(submission.slug || title);

    if (!wantedSlug) {
        return { error: "That title produces no address. Give the post a slug of its own." };
    }

    const existing = id ? await store.byId(id) : undefined;

    if (id && existing === undefined) {
        return { error: "That post no longer exists." };
    }

    const owner = existing?.authorId ?? actor.id;

    const allowed = existing ? await mayTouch(actor, "post", "update", owner) : await may(actor, "post", "create");

    if (!allowed) {
        return { error: "You do not have permission to write this post." };
    }

    // Checked on the server because the form only hides what it must not offer.
    if (status === "published" && !(await mayTouch(actor, "post", "publish", owner))) {
        return { error: "You may write this post, but not publish it." };
    }

    const slug =
        existing?.slug === wantedSlug ?
            wantedSlug
        :   await freeSlug(wantedSlug, async candidate => (await store.bySlug(candidate)) !== undefined);

    const publishedAt =
        status === "published" ? (existing?.publishedAt ?? new Date())
        : status === "draft" ? null
        : (existing?.publishedAt ?? null);

    if (existing) {
        await store.update(existing.id, { title, excerpt, body, status, slug, publishedAt });
    } else {
        await store.create({ title, excerpt, body, status, slug, publishedAt, authorId: actor.id });
    }

    revalidatePath("/admin/posts");
    redirect("/admin/posts");
}

export async function deletePost(formData: FormData): Promise<void> {
    const { actor, store } = await workspace();
    const id = String(formData.get("id") ?? "");
    const existing = await store.byId(id);

    if (existing === undefined) {
        redirect("/admin/posts");
    }

    if (!(await mayTouch(actor, "post", "delete", existing.authorId))) {
        throw new Error("You do not have permission to delete this post.");
    }

    await store.remove(id);

    revalidatePath("/admin/posts");
    redirect("/admin/posts");
}

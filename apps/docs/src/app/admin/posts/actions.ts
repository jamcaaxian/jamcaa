"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { toSlug } from "@jamcaa/core/content";
import { getSettings } from "@jamcaa/core/settings";
import { freePublicPostSlug } from "@/content/public-paths";
import { siteSettings } from "@/content/settings";
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

    return { actor, database, store: posts(database) };
}

export async function savePost(_previous: PostFormState, formData: FormData): Promise<PostFormState> {
    const { actor, database, store } = await workspace();

    const submission = readPostSubmission(formData);

    if ("error" in submission) {
        return submission;
    }

    const { id, title, excerpt, body, status } = submission;
    const existing = id ? await store.byId(id) : undefined;

    if (id && existing === undefined) {
        return { error: "That post no longer exists." };
    }

    const owner = existing?.authorId ?? actor.id;

    const allowed = existing ? await mayTouch(actor, "post", "update", owner) : await may(actor, "post", "create");

    if (!allowed) {
        return { error: "You do not have permission to write this post." };
    }

    const mayPublish = await mayTouch(actor, "post", "publish", owner);

    // Checked on the server because the form only hides what it must not offer.
    if (status === "published" && !mayPublish) {
        return { error: "You may write this post, but not publish it." };
    }

    const wantedSlug = toSlug(mayPublish ? submission.slug || title : existing?.slug || title);

    if (!wantedSlug) {
        return { error: "That title produces no address. Give the post a slug of its own." };
    }

    const publishedAt =
        status === "published" ? (existing?.publishedAt ?? new Date())
        : status === "draft" ? null
        : (existing?.publishedAt ?? null);
    const createdAt = existing?.createdAt ?? new Date();
    const pattern = (await getSettings(database, siteSettings)).get("permalink.post");
    const slug = await freePublicPostSlug({
        wanted: wantedSlug,
        pattern,
        publishedAt,
        createdAt,
        isTaken: async candidate => {
            const taken = await store.bySlug(candidate);

            return taken !== undefined && taken.id !== existing?.id;
        }
    });

    if (existing) {
        await store.update(existing.id, { title, excerpt, body, status, slug, publishedAt });
    } else {
        await store.create({ title, excerpt, body, status, slug, publishedAt, authorId: actor.id });
    }

    revalidatePath("/", "layout");
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

    revalidatePath("/", "layout");
    redirect("/admin/posts");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { toSlug } from "@jamcaa/core/content";
import { loadSettings } from "@jamcaa/core/settings";
import { incrementPublicAddressRevision } from "@/content/public-address-revision";
import { publicPostAddresses } from "@/content/public-addresses";
import { freePublicPostSlug, postAddress } from "@/content/public-paths";
import { siteSettings } from "@/content/settings";
import { formerPostAddresses, posts, writePostWithTags } from "@/content/store";
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

    // Checked on the server because the form only hides what it must not offer.
    if (status === "published" && !mayPublish) {
        return { error: "You may write this post, but not publish it." };
    }

    const addresses = publicPostAddresses(database);

    if (existing) {
        await writePostWithTags(
            database,
            tagIds,
            async () => {
                const current = await store.byId(existing.id);

                if (current === undefined) {
                    throw new Error("That post no longer exists.");
                }

                const pattern = (await loadSettings(database, siteSettings)).get("permalink.post");
                const publishedAt =
                    status === "published" ? (current.publishedAt ?? new Date())
                    : status === "draft" ? null
                    : (current.publishedAt ?? null);
                const wantedSlug = toSlug(mayPublish ? submission.slug || title : current.slug || title);

                if (!wantedSlug) {
                    throw new Error("That title produces no address. Give the post a slug of its own.");
                }

                const slug = await freePublicPostSlug({
                    wanted: wantedSlug,
                    pattern,
                    publishedAt,
                    createdAt: current.createdAt,
                    isTaken: async candidate => {
                        const taken = await store.bySlug(candidate);
                        const formerOwner = await formerPostAddresses(database).entryAt(
                            postAddress(pattern, { slug: candidate, publishedAt, createdAt: current.createdAt })
                        );

                        return (
                            (taken !== undefined && taken.id !== current.id)
                            || (formerOwner !== undefined && formerOwner !== current.id)
                        );
                    }
                });
                const changes = { title, excerpt, body, status, slug, publishedAt, categoryId };

                await addresses.recordEntryChange(current, { ...current, ...changes }, pattern);
                await store.update(current.id, changes);

                if (
                    current.slug !== slug
                    || current.status !== status
                    || current.publishedAt?.getTime() !== publishedAt?.getTime()
                ) {
                    await incrementPublicAddressRevision(database);
                }

                return current.id;
            },
            postId => postId
        );
    } else {
        await writePostWithTags(
            database,
            tagIds,
            async () => {
                const pattern = (await loadSettings(database, siteSettings)).get("permalink.post");
                const publishedAt = status === "published" ? new Date() : null;
                const createdAt = new Date();
                const wantedSlug = toSlug(submission.slug || title);

                if (!wantedSlug) {
                    throw new Error("That title produces no address. Give the post a slug of its own.");
                }

                const slug = await freePublicPostSlug({
                    wanted: wantedSlug,
                    pattern,
                    publishedAt,
                    createdAt,
                    isTaken: async candidate => {
                        const taken = await store.bySlug(candidate);
                        const formerOwner = await formerPostAddresses(database).entryAt(
                            postAddress(pattern, { slug: candidate, publishedAt, createdAt })
                        );

                        return taken !== undefined || formerOwner !== undefined;
                    }
                });

                await addresses.assertCurrentAvailable(
                    undefined,
                    postAddress(pattern, { slug, publishedAt, createdAt })
                );

                const created = await store.create({
                    title,
                    excerpt,
                    body,
                    status,
                    slug,
                    publishedAt,
                    authorId: actor.id,
                    categoryId
                });

                await incrementPublicAddressRevision(database);
                return created;
            },
            created => created.id
        );
    }

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

    await writePostWithTags(
        database,
        [],
        async () => {
            const current = await store.byId(id);

            if (current !== undefined) {
                await store.remove(id);
                await incrementPublicAddressRevision(database);
            }

            return id;
        },
        postId => postId
    );

    revalidatePath("/", "layout");
    redirect("/admin/posts");
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { editingFields } from "@jamcaaxian/core/content";
import type { EditingControlValue } from "@jamcaaxian/editor";
import { getSettings } from "@jamcaaxian/core/settings";
import { post } from "@/content/collections";
import { siteSettings } from "@/content/settings";
import { posts, postTagIds } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { PostForm } from "../post-form";
import { localizedEditingFields } from "@/content/admin-content";
import { adminMessages } from "@/content/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.posts.form.editTitle };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { locale, copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const terms = taxonomy(database);
    const [entry, settings, categories, tags] = await Promise.all([
        posts(database).byId((await params).id),
        getSettings(database, siteSettings),
        terms.listCategories(),
        terms.listTags()
    ]);

    if (entry === undefined) {
        notFound();
    }

    if (!(await mayTouch(actor, "post", "update", entry.authorId))) {
        return <p className="text-muted-foreground text-sm">{copy.posts.form.permissionUpdate}</p>;
    }

    const [mayPublish, mayDelete, selectedTagIds] = await Promise.all([
        mayTouch(actor, "post", "publish", entry.authorId),
        mayTouch(actor, "post", "delete", entry.authorId),
        postTagIds(database, entry.id)
    ]);
    const fields = localizedEditingFields(editingFields(post), locale);

    return (
        <PostForm
            fields={fields}
            titleFieldName={post.titleField}
            post={{
                id: entry.id,
                slug: entry.slug,
                status: entry.status,
                categoryId: entry.categoryId,
                fields: Object.fromEntries(
                    fields.map(field => [field.name, entry[field.name as keyof typeof entry] as EditingControlValue])
                )
            }}
            mayPublish={mayPublish}
            mayDelete={mayDelete}
            address={{ pattern: settings.get("permalink.post"), mayChooseSlug: mayPublish }}
            categories={categories}
            tags={tags}
            selectedTagIds={selectedTagIds}
        />
    );
}

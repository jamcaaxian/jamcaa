import type { Metadata } from "next";
import Link from "next/link";
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
import { DeletePostButton } from "../delete-post-button";
import { PostForm } from "../post-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
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
        return <p className="text-muted-foreground text-sm">This post is not yours to edit.</p>;
    }

    const mayPublish = await mayTouch(actor, "post", "publish", entry.authorId);
    const selectedTagIds = await postTagIds(database, entry.id);
    const fields = editingFields(post);

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <h1 className="text-lg font-semibold tracking-tight">Edit post</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/admin/posts/${encodeURIComponent(entry.id)}/revisions`} />}
                    >
                        Revisions
                    </Button>
                    <Button
                        variant="outline"
                        nativeButton={false}
                        render={
                            <Link
                                href={`/preview/posts/${encodeURIComponent(entry.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            />
                        }
                    >
                        Preview
                    </Button>
                    {(await mayTouch(actor, "post", "delete", entry.authorId)) ?
                        <DeletePostButton id={entry.id} title={entry.title} />
                    :   null}
                </div>
            </div>

            <PostForm
                fields={fields}
                titleFieldName={post.titleField}
                post={{
                    id: entry.id,
                    slug: entry.slug,
                    status: entry.status,
                    categoryId: entry.categoryId,
                    fields: Object.fromEntries(
                        fields.map(field => [
                            field.name,
                            entry[field.name as keyof typeof entry] as EditingControlValue
                        ])
                    )
                }}
                mayPublish={mayPublish}
                address={{ pattern: settings.get("permalink.post"), mayChooseSlug: mayPublish }}
                categories={categories}
                tags={tags}
                selectedTagIds={selectedTagIds}
            />
        </div>
    );
}

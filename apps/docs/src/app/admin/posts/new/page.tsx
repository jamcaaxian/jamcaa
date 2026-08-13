import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { editingFields } from "@jamcaaxian/core/content";
import { getSettings } from "@jamcaaxian/core/settings";
import { post } from "@/content/collections";
import { siteSettings } from "@/content/settings";
import { taxonomy } from "@/content/taxonomy";
import { may, mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "post", "create"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to write posts.</p>;
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const terms = taxonomy(database);
    const [mayPublish, settings, categories, tags] = await Promise.all([
        mayTouch(actor, "post", "publish", actor.id),
        getSettings(database, siteSettings),
        terms.listCategories(),
        terms.listTags()
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold tracking-tight">New post</h1>
            <PostForm
                fields={editingFields(post)}
                titleFieldName={post.titleField}
                mayPublish={mayPublish}
                address={{ pattern: settings.get("permalink.post"), mayChooseSlug: mayPublish }}
                categories={categories}
                tags={tags}
                selectedTagIds={[]}
            />
        </div>
    );
}

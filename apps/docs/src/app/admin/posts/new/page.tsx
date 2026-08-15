import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { editingFields } from "@jamcaaxian/core/content";
import { getSettings } from "@jamcaaxian/core/settings";
import { localizedEditingFields } from "@/content/admin-content";
import { adminMessages } from "@/content/admin-locale";
import { post } from "@/content/collections";
import { siteSettings } from "@/content/settings";
import { taxonomy } from "@/content/taxonomy";
import { may, mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { PostForm } from "../post-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.posts.form.newTitle };
}

export default async function NewPostPage() {
    const { locale, copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "post", "create"))) {
        return <p className="text-muted-foreground text-sm">{copy.posts.form.permissionCreate}</p>;
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
            <h1 className="text-xl font-semibold tracking-tight">{copy.posts.form.newTitle}</h1>
            <PostForm
                fields={localizedEditingFields(editingFields(post), locale)}
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

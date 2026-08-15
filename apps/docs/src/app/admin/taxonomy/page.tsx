import type { Metadata } from "next";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminMessages } from "@/content/admin-locale";
import { taxonomy } from "@/content/taxonomy";
import { may, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { TaxonomyForms } from "./taxonomy-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.taxonomy.title };
}

export default async function TaxonomyPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor: Actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "taxonomy", "manage"))) {
        return <p className="text-muted-foreground text-sm">{copy.taxonomy.permission}</p>;
    }

    const { env } = getCloudflareContext();
    const store = taxonomy(createDatabase(env.DB));
    const [categories, tags] = await Promise.all([store.listCategories(), store.listTags()]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight">{copy.taxonomy.title}</h1>
                <p className="text-muted-foreground text-sm">{copy.taxonomy.description}</p>
            </div>
            <TaxonomyForms categories={categories} tags={tags} />
        </div>
    );
}

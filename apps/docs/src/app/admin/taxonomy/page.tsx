import type { Metadata } from "next";
import { createDatabase } from "@jamcaa/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { taxonomy } from "@/content/taxonomy";
import { may, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { TaxonomyForms } from "./taxonomy-form";

export const metadata: Metadata = { title: "Taxonomy" };

export default async function TaxonomyPage() {
    const session = await requireSession();
    const actor: Actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "taxonomy", "manage"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to manage taxonomy.</p>;
    }

    const { env } = getCloudflareContext();
    const store = taxonomy(createDatabase(env.DB));
    const [categories, tags] = await Promise.all([store.listCategories(), store.listTags()]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-lg font-semibold tracking-tight">Taxonomy</h1>
                <p className="text-muted-foreground text-sm">
                    Organise Posts with hierarchical Categories and flat Tags.
                </p>
            </div>
            <TaxonomyForms categories={categories} tags={tags} />
        </div>
    );
}

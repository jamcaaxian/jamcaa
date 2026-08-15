"use server";

import { revalidatePath } from "next/cache";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AdminCopy } from "@/content/admin-copy";
import { adminMessages } from "@/content/admin-locale";
import { taxonomy } from "@/content/taxonomy";
import { may, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type TaxonomyFormState = { error?: string; saved?: boolean };

async function manager(copy: AdminCopy) {
    const session = await requireSession();
    const actor: Actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "taxonomy", "manage"))) {
        throw new Error(copy.taxonomy.permission);
    }

    const { env } = getCloudflareContext();

    return taxonomy(createDatabase(env.DB));
}

function value(formData: FormData, name: string) {
    return String(formData.get(name) ?? "").trim();
}

function errorMessage(error: unknown, copy: AdminCopy) {
    if (!(error instanceof Error)) {
        return copy.taxonomy.errors.saveFailed;
    }

    if (/UNIQUE constraint failed: (category|tag)\.slug/i.test(String(error.cause ?? error.message))) {
        return copy.taxonomy.errors.slugUsed;
    }

    if (/FOREIGN KEY constraint failed/i.test(String(error.cause ?? error.message))) {
        return copy.taxonomy.errors.assigned;
    }

    const messages: Record<string, string> = {
        "A taxonomy term needs a name or slug that produces an address.": copy.taxonomy.errors.termRequired,
        "A Category cannot become its own descendant.": copy.taxonomy.errors.ownDescendant,
        "The existing Category hierarchy contains a cycle.": copy.taxonomy.errors.cycle,
        "The parent Category does not exist.": copy.taxonomy.errors.parentMissing,
        "A Category needs a name.": copy.taxonomy.errors.categoryName,
        "The Category was written but could not be read back.": copy.taxonomy.errors.categoryReadBack,
        "That Category does not exist.": copy.taxonomy.errors.categoryMissing,
        "Move or remove this Category's children first.": copy.taxonomy.errors.childrenFirst,
        "A Tag needs a name.": copy.taxonomy.errors.tagName,
        "The Tag was written but could not be read back.": copy.taxonomy.errors.tagReadBack,
        "That Tag does not exist.": copy.taxonomy.errors.tagMissing
    };

    return messages[error.message] ?? copy.taxonomy.errors.saveFailed;
}

export async function saveCategory(_previous: TaxonomyFormState, formData: FormData): Promise<TaxonomyFormState> {
    const { copy } = await adminMessages();

    try {
        const store = await manager(copy);
        const id = value(formData, "id");
        const name = value(formData, "name");
        const slug = value(formData, "slug");
        const parentValue = value(formData, "parentId");
        const parentId = !parentValue || parentValue === "__none__" ? null : parentValue;

        if (id) {
            await store.updateCategory(id, { name, slug, parentId });
        } else {
            await store.createCategory({ name, slug, parentId });
        }

        revalidatePath("/admin/taxonomy");
        return { saved: true };
    } catch (error) {
        return { error: errorMessage(error, copy) };
    }
}

export async function saveTag(_previous: TaxonomyFormState, formData: FormData): Promise<TaxonomyFormState> {
    const { copy } = await adminMessages();

    try {
        const store = await manager(copy);
        const id = value(formData, "id");
        const name = value(formData, "name");
        const slug = value(formData, "slug");

        if (id) {
            await store.updateTag(id, { name, slug });
        } else {
            await store.createTag({ name, slug });
        }

        revalidatePath("/admin/taxonomy");
        return { saved: true };
    } catch (error) {
        return { error: errorMessage(error, copy) };
    }
}

export async function deleteCategory(formData: FormData): Promise<void> {
    const { copy } = await adminMessages();

    try {
        const store = await manager(copy);
        await store.removeCategory(value(formData, "id"));
        revalidatePath("/admin/taxonomy");
    } catch (error) {
        throw new Error(errorMessage(error, copy));
    }
}

export async function deleteTag(formData: FormData): Promise<void> {
    const { copy } = await adminMessages();

    try {
        const store = await manager(copy);
        await store.removeTag(value(formData, "id"));
        revalidatePath("/admin/taxonomy");
    } catch (error) {
        throw new Error(errorMessage(error, copy));
    }
}

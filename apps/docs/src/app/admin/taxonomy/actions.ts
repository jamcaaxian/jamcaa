"use server";

import { revalidatePath } from "next/cache";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { taxonomy } from "@/content/taxonomy";
import { may, type Actor } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type TaxonomyFormState = { error?: string; saved?: boolean };

async function manager() {
    const session = await requireSession();
    const actor: Actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "taxonomy", "manage"))) {
        throw new Error("You do not have permission to manage taxonomy.");
    }

    const { env } = getCloudflareContext();

    return taxonomy(createDatabase(env.DB));
}

function value(formData: FormData, name: string) {
    return String(formData.get(name) ?? "").trim();
}

function errorMessage(error: unknown) {
    if (!(error instanceof Error)) {
        return "Taxonomy could not be saved.";
    }

    if (/UNIQUE constraint failed: (category|tag)\.slug/i.test(String(error.cause ?? error.message))) {
        return "That slug is already in use.";
    }

    if (/FOREIGN KEY constraint failed/i.test(String(error.cause ?? error.message))) {
        return "This term is still assigned and cannot be removed.";
    }

    return error.message;
}

export async function saveCategory(_previous: TaxonomyFormState, formData: FormData): Promise<TaxonomyFormState> {
    try {
        const store = await manager();
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
        return { error: errorMessage(error) };
    }
}

export async function saveTag(_previous: TaxonomyFormState, formData: FormData): Promise<TaxonomyFormState> {
    try {
        const store = await manager();
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
        return { error: errorMessage(error) };
    }
}

export async function deleteCategory(formData: FormData): Promise<void> {
    const store = await manager();
    await store.removeCategory(value(formData, "id"));
    revalidatePath("/admin/taxonomy");
}

export async function deleteTag(formData: FormData): Promise<void> {
    const store = await manager();
    await store.removeTag(value(formData, "id"));
    revalidatePath("/admin/taxonomy");
}

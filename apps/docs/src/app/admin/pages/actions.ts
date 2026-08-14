"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { parseBlockDocument, type BlockDocument, type PageStatus } from "@jamcaaxian/core/content";
import { builtinBlockRegistry } from "@jamcaaxian/editor/blocks";
import { pages } from "@/content/pages-store";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type PageFormState = { error?: string; saved?: boolean };

async function permitted(action: "create" | "update" | "delete" | "publish"): Promise<string | undefined> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", action))) {
        return `You do not have permission to ${action} pages.`;
    }

    return undefined;
}

function readBody(formData: FormData): BlockDocument {
    const raw = formData.get("body");

    if (typeof raw !== "string" || raw === "") {
        return { version: 1, blocks: [] };
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        const checked = parseBlockDocument(parsed, builtinBlockRegistry);

        if (!checked.ok) {
            throw new Error(`The body has problems: ${checked.errors.join(" ")}`);
        }

        return checked.document;
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : "The body could not be read.");
    }
}

function readStatus(formData: FormData): PageStatus {
    return formData.get("status") === "published" ? "published" : "draft";
}

export async function createPage(_previous: PageFormState, formData: FormData): Promise<PageFormState> {
    const status = readStatus(formData);
    const denied = (await permitted("create")) ?? (status === "published" ? await permitted("publish") : undefined);

    if (denied !== undefined) {
        return { error: denied };
    }

    const title = String(formData.get("title") ?? "");
    const address = String(formData.get("address") ?? "");

    try {
        const body = readBody(formData);
        const { env } = getCloudflareContext();
        const result = await pages(createDatabase(env.DB)).create({ title, address, body, status });

        if (result.status === "rejected") {
            return { error: result.message };
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "The page could not be created." };
    }

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");

    return { saved: true };
}

export async function updatePage(id: string, _previous: PageFormState, formData: FormData): Promise<PageFormState> {
    const status = readStatus(formData);
    const denied = (await permitted("update")) ?? (status === "published" ? await permitted("publish") : undefined);

    if (denied !== undefined) {
        return { error: denied };
    }

    const title = String(formData.get("title") ?? "");
    const address = String(formData.get("address") ?? "");

    try {
        const body = readBody(formData);
        const { env } = getCloudflareContext();
        const result = await pages(createDatabase(env.DB)).update(id, { title, address, body, status });

        if (result.status === "rejected") {
            return { error: result.message };
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "The page could not be saved." };
    }

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");

    return { saved: true };
}

export async function deletePage(id: string): Promise<PageFormState> {
    const denied = await permitted("delete");

    if (denied !== undefined) {
        return { error: denied };
    }

    const { env } = getCloudflareContext();

    await pages(createDatabase(env.DB)).delete(id);

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");

    return { saved: true };
}

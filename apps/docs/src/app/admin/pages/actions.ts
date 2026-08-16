"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { parseBlockDocument, type BlockDocument, type PageStatus } from "@jamcaaxian/core/content";
import type { AdminCopy } from "@/content/admin-copy";
import { adminMessages } from "@/content/admin-locale";
import { pages } from "@/content/pages-store";
import { siteBlockRegistry } from "@/content/site-blocks";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type PageFormState = { error?: string; saved?: boolean };

class PageInputError extends Error {}

async function permitted(
    action: "create" | "update" | "delete" | "publish",
    copy: AdminCopy
): Promise<string | undefined> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "page", action))) {
        return copy.pages.errors.permission[action];
    }

    return undefined;
}

function readBody(formData: FormData, copy: AdminCopy): BlockDocument {
    const raw = formData.get("body");

    if (typeof raw !== "string" || raw === "") {
        return { version: 1, blocks: [] };
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        const checked = parseBlockDocument(parsed, siteBlockRegistry);

        if (!checked.ok) {
            throw new PageInputError(copy.pages.errors.bodyInvalid);
        }

        return checked.document;
    } catch (error) {
        if (error instanceof PageInputError) {
            throw error;
        }

        throw new PageInputError(copy.pages.errors.bodyUnreadable);
    }
}

function pageStoreProblem(message: string, copy: AdminCopy): string {
    const existing = /^A page at "(.+)" already exists\.$/.exec(message);

    if (existing?.[1] !== undefined) {
        return copy.pages.errors.addressExists(existing[1]);
    }

    const messages: Record<string, string> = {
        'A page address has to start with "/".': copy.pages.errors.addressStart,
        'A page address cannot end with "/".': copy.pages.errors.addressEnd,
        'A page address cannot contain "//".': copy.pages.errors.addressDoubleSlash,
        "A page needs a title.": copy.pages.errors.titleRequired,
        "No such page.": copy.pages.errors.missing,
        "The page could not be read back.": copy.pages.errors.readBack
    };

    return (
        messages[message] ?? (message.startsWith("The body has problems:") ? copy.pages.errors.bodyInvalid : message)
    );
}

function readStatus(formData: FormData): PageStatus {
    return formData.get("status") === "published" ? "published" : "draft";
}

export async function createPage(_previous: PageFormState, formData: FormData): Promise<PageFormState> {
    const { copy } = await adminMessages();
    const status = readStatus(formData);
    const denied =
        (await permitted("create", copy)) ?? (status === "published" ? await permitted("publish", copy) : undefined);

    if (denied !== undefined) {
        return { error: denied };
    }

    const title = String(formData.get("title") ?? "");
    const address = String(formData.get("address") ?? "");
    let pageId: string;

    try {
        const body = readBody(formData, copy);
        const { env } = getCloudflareContext();
        const result = await pages(createDatabase(env.DB)).create({ title, address, body, status });

        if (result.status === "rejected") {
            return { error: pageStoreProblem(result.message, copy) };
        }

        pageId = result.page.id;
    } catch (error) {
        return { error: error instanceof PageInputError ? error.message : copy.pages.errors.createFailed };
    }

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");
    redirect(`/admin/pages/${encodeURIComponent(pageId)}`);
}

export async function updatePage(id: string, _previous: PageFormState, formData: FormData): Promise<PageFormState> {
    const { copy } = await adminMessages();
    const status = readStatus(formData);
    const denied = await permitted("update", copy);

    if (denied !== undefined) {
        return { error: denied };
    }

    const title = String(formData.get("title") ?? "");
    const address = String(formData.get("address") ?? "");

    try {
        const { env } = getCloudflareContext();
        const store = pages(createDatabase(env.DB));
        const current = await store.byId(id);
        const publishDenied =
            status === "published" || current?.status === "published" ? await permitted("publish", copy) : undefined;

        if (publishDenied !== undefined) {
            return { error: publishDenied };
        }

        const body = readBody(formData, copy);
        const result = await store.update(id, { title, address, body, status });

        if (result.status === "rejected") {
            return { error: pageStoreProblem(result.message, copy) };
        }
    } catch (error) {
        return { error: error instanceof PageInputError ? error.message : copy.pages.errors.saveFailed };
    }

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");

    return { saved: true };
}

export async function deletePage(id: string): Promise<PageFormState> {
    const { copy } = await adminMessages();
    const denied = await permitted("delete", copy);

    if (denied !== undefined) {
        return { error: denied };
    }

    const { env } = getCloudflareContext();

    await pages(createDatabase(env.DB)).delete(id);

    revalidatePath("/admin/pages");
    revalidatePath("/", "layout");

    return { saved: true };
}

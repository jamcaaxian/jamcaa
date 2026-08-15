"use server";

import { revalidatePath } from "next/cache";
import { removeMedia } from "@jamcaaxian/core/media";
import { adminMessages } from "@/content/admin-locale";
import { mediaRuntime } from "@/lib/media";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { mediaById } from "@jamcaaxian/core/media";

export async function deleteMedia(formData: FormData): Promise<void> {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };
    const id = String(formData.get("id") ?? "");

    const { database, bindings, credentials } = mediaRuntime();
    const record = await mediaById(database, id);

    if (record === undefined) {
        return;
    }

    if (!(await mayTouch(actor, "media", "delete", record.uploaderId))) {
        throw new Error(copy.media.deleteDenied);
    }

    await removeMedia({ database, bindings, credentials, id });

    revalidatePath("/admin/media");
}

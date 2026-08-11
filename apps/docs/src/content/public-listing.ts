import { notFound } from "next/navigation";
import type { EntrySummaryPage } from "@jamcaa/core/content";
import type { post } from "@/content/collections";

/** A shared public list address must not become a server error when its cursor is forged. */
export async function publicPostPage(
    read: () => Promise<EntrySummaryPage<typeof post>>
): Promise<EntrySummaryPage<typeof post>> {
    try {
        return await read();
    } catch (error) {
        if (error instanceof Error && error.message === "The Entry Summary cursor is invalid.") {
            notFound();
        }

        throw error;
    }
}

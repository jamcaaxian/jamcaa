import { notFound } from "next/navigation";
import { isInvalidEntrySummaryCursor } from "@/content/public-listing";

/** A shared public list address must not become a server error when its cursor is forged. */
export async function publicPostPage<T>(read: () => Promise<T>): Promise<T> {
    try {
        return await read();
    } catch (error) {
        if (isInvalidEntrySummaryCursor(error)) {
            notFound();
        }

        throw error;
    }
}

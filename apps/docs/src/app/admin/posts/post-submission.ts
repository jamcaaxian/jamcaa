import { isRichTextEmpty, parseRichText, type EntryStatus, type RichTextDocument } from "@jamcaa/core/content";

const statuses: EntryStatus[] = ["draft", "published", "archived"];

export interface PostSubmission {
    id: string;
    title: string;
    excerpt: string;
    body: RichTextDocument;
    status: EntryStatus;
    slug: string;
}

export function readPostSubmission(formData: FormData): PostSubmission | { error: string } {
    const title = String(formData.get("title") ?? "").trim();
    let body: RichTextDocument;

    try {
        body = parseRichText(String(formData.get("body") ?? ""));
    } catch {
        return { error: "The Post body is not valid rich text." };
    }

    if (!title || isRichTextEmpty(body)) {
        return { error: "A Post needs a title and a body." };
    }

    const candidate = String(formData.get("status") ?? "draft") as EntryStatus;

    return {
        id: String(formData.get("id") ?? ""),
        title,
        excerpt: String(formData.get("excerpt") ?? "").trim(),
        body,
        status: statuses.includes(candidate) ? candidate : "draft",
        slug: String(formData.get("slug") ?? "")
    };
}

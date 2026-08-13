import { parseCollectionSubmission, type EntryStatus, type RichTextDocument } from "@jamcaaxian/core/content";
import { post } from "@/content/collections";

const statuses: EntryStatus[] = ["draft", "published", "archived"];

export interface PostSubmission {
    id: string;
    title: string;
    excerpt: string | null;
    body: RichTextDocument;
    status: EntryStatus;
    slug: string;
    categoryId: string;
    tagIds: string[];
}

export function readPostSubmission(formData: FormData): PostSubmission | { error: string } {
    const fields = parseCollectionSubmission(post, formData);

    if (!fields.success) {
        const invalidRichText = fields.issues.some(
            issue => issue.code === "invalid" && post.fields[issue.field]?.kind === "richText"
        );

        if (invalidRichText) {
            return { error: "The Post body is not valid rich text." };
        }

        if (fields.issues.some(issue => issue.code === "required")) {
            return { error: "A Post needs a title and a body." };
        }

        return { error: "One of the Post fields is not valid." };
    }

    const { title, body } = fields.values;
    const excerpt = fields.values.excerpt ?? "";

    if (!title) {
        return { error: "A Post needs a title and a body." };
    }

    const candidate = String(formData.get("status") ?? "draft") as EntryStatus;
    const categoryId = String(formData.get("categoryId") ?? "").trim();

    if (!categoryId) {
        return { error: "Select a category." };
    }

    return {
        id: String(formData.get("id") ?? ""),
        title,
        excerpt,
        body,
        status: statuses.includes(candidate) ? candidate : "draft",
        slug: String(formData.get("slug") ?? ""),
        categoryId,
        tagIds: formData
            .getAll("tagIds")
            .map(value => String(value).trim())
            .filter(Boolean)
    };
}

import { parseCollectionSubmission, type BlockDocument, type EntryStatus } from "@jamcaaxian/core/content";
import { adminCopy, type AdminCopy } from "@/content/admin-copy";
import { post } from "@/content/collections";

const statuses: EntryStatus[] = ["draft", "published", "archived"];

export interface PostSubmission {
    id: string;
    title: string;
    excerpt: string | null;
    body: BlockDocument;
    status: EntryStatus;
    slug: string;
    categoryId: string;
    tagIds: string[];
}

export function readPostSubmission(
    formData: FormData,
    errors: AdminCopy["posts"]["errors"] = adminCopy("en-US").posts.errors
): PostSubmission | { error: string } {
    const fields = parseCollectionSubmission(post, formData);

    if (!fields.success) {
        const invalidRichText = fields.issues.some(
            issue => issue.code === "invalid" && ["richText", "blocks"].includes(post.fields[issue.field]?.kind ?? "")
        );

        if (invalidRichText) {
            return { error: errors.invalidBody };
        }

        if (fields.issues.some(issue => issue.code === "required")) {
            return { error: errors.required };
        }

        return { error: errors.invalidField };
    }

    const { title, body } = fields.values;
    const excerpt = fields.values.excerpt ?? "";

    if (!title) {
        return { error: errors.required };
    }

    const candidate = String(formData.get("status") ?? "draft") as EntryStatus;
    const categoryId = String(formData.get("categoryId") ?? "").trim();

    if (!categoryId) {
        return { error: errors.selectCategory };
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

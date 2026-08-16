import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    adminMessages: vi.fn(),
    byId: vi.fn(),
    categoryById: vi.fn(),
    commitPostState: vi.fn(),
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    may: vi.fn(),
    mayTouch: vi.fn(),
    readPostSubmission: vi.fn(),
    redirect: vi.fn(),
    requireSession: vi.fn(),
    revalidatePath: vi.fn(),
    tagById: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocked.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocked.redirect }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@/content/admin-locale", () => ({ adminMessages: mocked.adminMessages }));
vi.mock("@/content/post-writes", () => ({ commitPostState: mocked.commitPostState }));
vi.mock("@/content/store", () => ({ posts: () => ({ byId: mocked.byId }), writePostWithTags: vi.fn() }));
vi.mock("@/content/taxonomy", () => ({
    taxonomy: () => ({ categoryById: mocked.categoryById, tagById: mocked.tagById })
}));
vi.mock("@/lib/permissions", () => ({ may: mocked.may, mayTouch: mocked.mayTouch }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));
vi.mock("@/app/admin/posts/post-submission", () => ({ readPostSubmission: mocked.readPostSubmission }));

import { savePost } from "@/app/admin/posts/actions";

const copy = {
    posts: {
        errors: {
            missing: "That Post no longer exists.",
            writeDenied: "You do not have permission to write this Post.",
            taxonomyDenied: "You do not have permission to assign Taxonomy.",
            categoryMissing: "The selected Category no longer exists.",
            tagMissing: "One of the selected Tags no longer exists.",
            publishDenied: "You may write this Post, but not change whether it is published."
        }
    }
};

const submission = {
    id: "",
    title: "Post title",
    excerpt: "Summary",
    body: { version: 1 as const, blocks: [] },
    status: "draft" as const,
    slug: "post-title",
    categoryId: "category-1",
    tagIds: ["tag-1"]
};

describe("saving a Post from the editing workspace", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.adminMessages.mockResolvedValue({ copy });
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.requireSession.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        mocked.readPostSubmission.mockReturnValue(submission);
        mocked.may.mockResolvedValue(true);
        mocked.mayTouch.mockResolvedValue(true);
        mocked.categoryById.mockResolvedValue({ id: "category-1" });
        mocked.tagById.mockResolvedValue({ id: "tag-1" });
        mocked.commitPostState.mockResolvedValue({ id: "post-2" });
        mocked.redirect.mockImplementation(() => {
            throw new Error("redirect");
        });
    });

    it("moves a new Post into its editing workspace", async () => {
        mocked.byId.mockResolvedValue(undefined);

        await expect(savePost({}, new FormData())).rejects.toThrow("redirect");

        expect(mocked.redirect).toHaveBeenCalledWith("/admin/posts/post-2");
        expect(mocked.revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("keeps an existing Post in place after saving", async () => {
        mocked.readPostSubmission.mockReturnValue({ ...submission, id: "post-1" });
        mocked.byId.mockResolvedValue({ id: "post-1", authorId: "author-1", status: "draft" });
        mocked.commitPostState.mockResolvedValue({ id: "post-1" });

        await expect(savePost({}, new FormData())).resolves.toEqual({ saved: true });

        expect(mocked.redirect).not.toHaveBeenCalled();
        expect(mocked.commitPostState).toHaveBeenCalledWith(
            expect.objectContaining({ desired: expect.objectContaining({ id: "post-1" }) })
        );
    });
});

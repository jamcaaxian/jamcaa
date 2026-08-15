import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    getSession: vi.fn(),
    adminMessages: vi.fn(),
    mayTouch: vi.fn(),
    notFound: vi.fn(),
    publicMoment: vi.fn(),
    redirect: vi.fn(),
    byId: vi.fn()
}));

vi.mock("next/navigation", () => ({ notFound: mocked.notFound, redirect: mocked.redirect }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@/components/public/post-content", () => ({ PostContent: () => null }));
vi.mock("@/content/admin-locale", () => ({ adminMessages: mocked.adminMessages }));
vi.mock("@/content/public-site", () => ({ publicMoment: mocked.publicMoment }));
vi.mock("@/content/store", () => ({ posts: () => ({ byId: mocked.byId }) }));
vi.mock("@/lib/permissions", () => ({ mayTouch: mocked.mayTouch }));
vi.mock("@/lib/session", () => ({ getSession: mocked.getSession }));

import PreviewPostPage, { generateMetadata } from "@/app/preview/posts/[id]/page";

const updatedAt = new Date("2026-08-12T03:00:00.000Z");
const entry = {
    id: "entry-1",
    slug: "previewed",
    status: "draft" as const,
    authorId: "author-1",
    categoryId: "jamcaa-default-category",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt,
    publishedAt: null,
    locale: "en-US" as const,
    translationId: "entry-1",
    title: "Previewed Post",
    excerpt: "Saved summary",
    body: { type: "doc" as const, content: [] }
};

describe("the authenticated Post Preview route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.getSession.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        mocked.adminMessages.mockResolvedValue({
            locale: "en-US",
            copy: {
                posts: {
                    preview: {
                        title: "Post preview",
                        back: "Edit Post",
                        status: {
                            draft: "Draft preview saved",
                            archived: "Archived preview saved",
                            published: "Published preview saved"
                        }
                    }
                }
            }
        });
        mocked.byId.mockResolvedValue(entry);
        mocked.mayTouch.mockResolvedValue(true);
        mocked.publicMoment.mockResolvedValue({ dateTime: updatedAt.toISOString(), label: "2026-08-12 03:00" });
        mocked.notFound.mockImplementation(() => {
            throw new Error("not found");
        });
        mocked.redirect.mockImplementation(() => {
            throw new Error("redirect");
        });
    });

    it("keeps Preview pages out of search indexes and canonical discovery", async () => {
        const metadata = await generateMetadata();

        expect(metadata).toMatchObject({
            title: "Post preview",
            robots: { index: false, follow: false, noarchive: true, nocache: true }
        });
        expect(metadata).not.toHaveProperty("alternates.canonical");
    });

    it("sends an anonymous visitor to sign in and preserves the Preview address", async () => {
        mocked.getSession.mockResolvedValue(null);

        await expect(PreviewPostPage({ params: Promise.resolve({ id: "entry-1" }) })).rejects.toThrow("redirect");

        expect(mocked.redirect).toHaveBeenCalledWith("/login?next=%2Fpreview%2Fposts%2Fentry-1");
        expect(mocked.byId).not.toHaveBeenCalled();
    });

    it("does not reveal whether a missing or unauthorized Entry exists", async () => {
        mocked.byId.mockResolvedValueOnce(undefined);

        await expect(PreviewPostPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("not found");
        expect(mocked.mayTouch).not.toHaveBeenCalled();

        mocked.byId.mockResolvedValueOnce(entry);
        mocked.mayTouch.mockResolvedValueOnce(false);

        await expect(PreviewPostPage({ params: Promise.resolve({ id: entry.id }) })).rejects.toThrow("not found");
        expect(mocked.mayTouch).toHaveBeenCalledWith(
            { id: "author-1", role: "author" },
            "post",
            "update",
            entry.authorId
        );
    });

    it.each([
        ["draft", "Draft preview saved"],
        ["archived", "Archived preview saved"],
        ["published", "Published preview saved"]
    ] as const)("renders a saved %s Post through the public presentation", async (status, statusLabel) => {
        mocked.byId.mockResolvedValue({ ...entry, status });

        const rendered = await PreviewPostPage({ params: Promise.resolve({ id: entry.id }) });

        expect(mocked.byId).toHaveBeenCalledWith(entry.id);
        expect(mocked.publicMoment).toHaveBeenCalledWith(updatedAt, "en-US");
        expect(rendered.props).toMatchObject({
            post: { id: entry.id, status },
            publishedLabel: "2026-08-12 03:00",
            statusLabel,
            statusMoment: updatedAt,
            backAddress: "/admin/posts/entry-1",
            backLabel: "Edit Post"
        });
    });

    it("uses the selected Admin Locale for Preview copy", async () => {
        mocked.adminMessages.mockResolvedValue({
            locale: "zh-Hans-CN",
            copy: {
                posts: {
                    preview: {
                        title: "文章预览",
                        back: "编辑文章",
                        status: {
                            draft: "草稿预览已保存",
                            archived: "归档预览已保存",
                            published: "已发布版本预览已保存"
                        }
                    }
                }
            }
        });

        const metadata = await generateMetadata();
        const rendered = await PreviewPostPage({ params: Promise.resolve({ id: entry.id }) });

        expect(metadata.title).toBe("文章预览");
        expect(rendered.props).toMatchObject({ statusLabel: "草稿预览已保存", backLabel: "编辑文章" });
    });
});

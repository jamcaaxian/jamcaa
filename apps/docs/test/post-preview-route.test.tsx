import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    getSession: vi.fn(),
    mayTouch: vi.fn(),
    notFound: vi.fn(),
    publicMoment: vi.fn(),
    redirect: vi.fn(),
    byId: vi.fn()
}));

vi.mock("next/navigation", () => ({ notFound: mocked.notFound, redirect: mocked.redirect }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaa/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@/components/public/post-content", () => ({ PostContent: () => null }));
vi.mock("@/content/public-site", () => ({ publicMoment: mocked.publicMoment }));
vi.mock("@/content/store", () => ({ posts: () => ({ byId: mocked.byId }) }));
vi.mock("@/lib/permissions", () => ({ mayTouch: mocked.mayTouch }));
vi.mock("@/lib/session", () => ({ getSession: mocked.getSession }));

import PreviewPostPage, { metadata } from "@/app/preview/posts/[id]/page";

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

    it("keeps Preview pages out of search indexes and canonical discovery", () => {
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
        expect(mocked.publicMoment).toHaveBeenCalledWith(updatedAt);
        expect(rendered.props).toMatchObject({
            post: { id: entry.id, status },
            publishedLabel: "2026-08-12 03:00",
            statusLabel,
            statusMoment: updatedAt,
            backAddress: "/admin/posts/entry-1",
            backLabel: "Edit Post"
        });
    });
});

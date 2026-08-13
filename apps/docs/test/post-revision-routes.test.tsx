import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    getSettings: vi.fn(),
    list: vi.fn(),
    mayTouch: vi.fn(),
    notFound: vi.fn(),
    postById: vi.fn(),
    requireSession: vi.fn(),
    revisionById: vi.fn()
}));

vi.mock("next/navigation", () => ({ notFound: mocked.notFound }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@jamcaaxian/core/settings", () => ({ getSettings: mocked.getSettings }));
vi.mock("@jamcaaxian/editor/content", () => ({ RichTextContent: () => null }));
vi.mock("@/components/ui/badge", () => ({ Badge: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/card", () => ({
    Card: () => null,
    CardContent: () => null,
    CardHeader: () => null,
    CardTitle: () => null
}));
vi.mock("@/components/ui/table", () => ({
    Table: () => null,
    TableBody: () => null,
    TableCell: () => null,
    TableHead: () => null,
    TableHeader: () => null,
    TableRow: () => null
}));
vi.mock("@/content/settings", () => ({ siteSettings: {} }));
vi.mock("@/content/store", () => ({
    posts: () => ({ byId: mocked.postById }),
    postRevisions: () => ({ list: mocked.list, byId: mocked.revisionById })
}));
vi.mock("@/content/taxonomy", () => ({ taxonomy: () => ({ categoryById: vi.fn(), tagById: vi.fn() }) }));
vi.mock("@/lib/permissions", () => ({ mayTouch: mocked.mayTouch }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));

import PostRevisionPage from "@/app/admin/posts/[id]/revisions/[revisionId]/page";
import PostRevisionsPage from "@/app/admin/posts/[id]/revisions/page";

const entry = { id: "entry-1", authorId: "author-1", title: "Current", status: "draft" };
const revision = {
    id: "revision-1",
    entryId: entry.id,
    formatVersion: 1,
    createdAt: new Date("2026-08-12T03:00:00.000Z"),
    snapshot: {
        slug: "earlier",
        status: "draft",
        publishedAt: null,
        categoryId: "jamcaa-default-category",
        fields: { title: "Earlier", excerpt: null, body: { type: "doc", content: [] } },
        tagIds: []
    }
};

describe("Post Revision routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.requireSession.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        mocked.postById.mockResolvedValue(entry);
        mocked.revisionById.mockResolvedValue(revision);
        mocked.list.mockResolvedValue([revision]);
        mocked.mayTouch.mockResolvedValue(true);
        mocked.getSettings.mockResolvedValue({ get: () => "yyyy-MM-dd" });
        mocked.notFound.mockImplementation(() => {
            throw new Error("not found");
        });
    });

    it("does not reveal whether a missing or unauthorized Post exists", async () => {
        mocked.postById.mockResolvedValueOnce(undefined);

        await expect(PostRevisionsPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("not found");
        expect(mocked.mayTouch).not.toHaveBeenCalled();

        mocked.postById.mockResolvedValueOnce(entry);
        mocked.mayTouch.mockResolvedValueOnce(false);

        await expect(PostRevisionsPage({ params: Promise.resolve({ id: entry.id }) })).rejects.toThrow("not found");
    });

    it("does not reveal missing, cross-Post, or unauthorized Revisions", async () => {
        mocked.postById.mockResolvedValueOnce(entry);
        mocked.revisionById.mockResolvedValueOnce(undefined);

        await expect(
            PostRevisionPage({ params: Promise.resolve({ id: entry.id, revisionId: "missing" }) })
        ).rejects.toThrow("not found");

        mocked.postById.mockResolvedValueOnce(entry);
        mocked.revisionById.mockResolvedValueOnce(revision);
        mocked.mayTouch.mockResolvedValueOnce(false);

        await expect(
            PostRevisionPage({ params: Promise.resolve({ id: entry.id, revisionId: revision.id }) })
        ).rejects.toThrow("not found");
    });

    it("renders authorized history and detail through Entry-scoped reads", async () => {
        const history = await PostRevisionsPage({ params: Promise.resolve({ id: entry.id }) });
        const detail = await PostRevisionPage({ params: Promise.resolve({ id: entry.id, revisionId: revision.id }) });

        expect(mocked.list).toHaveBeenCalledWith(entry.id);
        expect(mocked.revisionById).toHaveBeenCalledWith(entry.id, revision.id);
        expect(history).toBeTruthy();
        expect(detail).toBeTruthy();
    });
});

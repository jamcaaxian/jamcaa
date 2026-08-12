import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    byId: vi.fn(),
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    may: vi.fn(),
    mayTouch: vi.fn(),
    redirect: vi.fn(),
    requireSession: vi.fn(),
    restorePostRevision: vi.fn(),
    revisionById: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocked.redirect }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaa/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@/content/post-writes", () => ({ restorePostRevision: mocked.restorePostRevision }));
vi.mock("@/content/store", () => ({
    posts: () => ({ byId: mocked.byId }),
    postRevisions: () => ({ byId: mocked.revisionById })
}));
vi.mock("@/lib/permissions", () => ({ may: mocked.may, mayTouch: mocked.mayTouch }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));

import { restoreRevision } from "@/app/admin/posts/[id]/revisions/actions";

const entry = { id: "entry-1", authorId: "author-1" };
const revision = { id: "revision-1", snapshot: { status: "published", slug: "earlier", publishedAt: 1 } };

describe("restoring a Post Revision", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.requireSession.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        mocked.byId.mockResolvedValue(entry);
        mocked.revisionById.mockResolvedValue(revision);
        mocked.may.mockResolvedValue(true);
        mocked.mayTouch.mockResolvedValue(true);
        mocked.restorePostRevision.mockResolvedValue(undefined);
        mocked.redirect.mockImplementation(() => {
            throw new Error("redirect");
        });
    });

    it("requires update, Taxonomy read, and publish capability for a published Revision", async () => {
        mocked.mayTouch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const formData = new FormData();
        formData.set("entryId", entry.id);
        formData.set("revisionId", revision.id);

        await expect(restoreRevision({}, formData)).resolves.toMatchObject({
            error: expect.stringMatching(/publish/i)
        });
        expect(mocked.restorePostRevision).not.toHaveBeenCalled();
    });

    it("requires publish capability when a historical publication time would change", async () => {
        mocked.byId.mockResolvedValue({ ...entry, slug: "same", publishedAt: new Date(2) });
        mocked.revisionById.mockResolvedValue({
            ...revision,
            snapshot: { status: "archived", slug: "same", publishedAt: 1 }
        });
        mocked.mayTouch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const formData = new FormData();
        formData.set("entryId", entry.id);
        formData.set("revisionId", revision.id);

        await expect(restoreRevision({}, formData)).resolves.toMatchObject({
            error: expect.stringMatching(/publish/i)
        });
        expect(mocked.restorePostRevision).not.toHaveBeenCalled();
    });

    it("requires publish capability when Restore would take a published Post offline", async () => {
        mocked.byId.mockResolvedValue({ ...entry, status: "published", slug: "same", publishedAt: new Date(1) });
        mocked.revisionById.mockResolvedValue({
            ...revision,
            snapshot: { status: "archived", slug: "same", publishedAt: 1 }
        });
        mocked.mayTouch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const formData = new FormData();
        formData.set("entryId", entry.id);
        formData.set("revisionId", revision.id);

        await expect(restoreRevision({}, formData)).resolves.toMatchObject({
            error: expect.stringMatching(/publish/i)
        });
        expect(mocked.restorePostRevision).not.toHaveBeenCalled();
    });

    it("passes only trusted identifiers to the server-side restore seam", async () => {
        const formData = new FormData();
        formData.set("entryId", entry.id);
        formData.set("revisionId", revision.id);

        await expect(restoreRevision({}, formData)).rejects.toThrow("redirect");

        expect(mocked.restorePostRevision).toHaveBeenCalledWith({
            database: "database",
            actorId: "author-1",
            mayPublish: true,
            entryId: entry.id,
            revisionId: revision.id
        });
    });
});

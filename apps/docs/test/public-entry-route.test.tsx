import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    notFound: vi.fn(),
    permanentRedirect: vi.fn(),
    publicMoment: vi.fn(),
    publishedPostAt: vi.fn()
}));

vi.mock("next/navigation", () => ({ notFound: mocked.notFound, permanentRedirect: mocked.permanentRedirect }));
vi.mock("@/components/public/post-content", () => ({ PostContent: () => null }));
vi.mock("@/content/public-site", () => ({
    publicMoment: mocked.publicMoment,
    publishedPostAt: mocked.publishedPostAt
}));

import PublicEntryPage from "@/app/[...path]/page";

const entry = {
    id: "entry-1",
    slug: "current",
    status: "published" as const,
    authorId: "author-1",
    categoryId: "jamcaa-default-category",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    publishedAt: new Date("2026-08-03T00:00:00.000Z"),
    title: "Current Post",
    excerpt: "Current summary",
    body: { type: "doc" as const, content: [] }
};

describe("the public Entry catch-all route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.notFound.mockImplementation(() => {
            throw new Error("not found");
        });
        mocked.permanentRedirect.mockImplementation(() => {
            throw new Error("permanent redirect");
        });
        mocked.publicMoment.mockResolvedValue({ label: "2026-08-03" });
    });

    it("renders the current canonical Entry", async () => {
        mocked.publishedPostAt.mockResolvedValue({ kind: "entry", entry });

        const rendered = await PublicEntryPage({ params: Promise.resolve({ path: ["current"] }) });

        expect(mocked.publishedPostAt).toHaveBeenCalledWith(["current"]);
        expect(mocked.publicMoment).toHaveBeenCalledWith(entry.publishedAt);
        expect(rendered.props).toMatchObject({ post: entry, publishedLabel: "2026-08-03" });
        expect(mocked.permanentRedirect).not.toHaveBeenCalled();
        expect(mocked.notFound).not.toHaveBeenCalled();
    });

    it("permanently redirects a Former Address directly to the latest canonical address", async () => {
        mocked.publishedPostAt.mockResolvedValue({ kind: "former", entry, address: "/latest/current" });

        await expect(PublicEntryPage({ params: Promise.resolve({ path: ["former", "address"] }) })).rejects.toThrow(
            "permanent redirect"
        );

        expect(mocked.permanentRedirect).toHaveBeenCalledWith("/latest/current");
        expect(mocked.publicMoment).not.toHaveBeenCalled();
    });

    it("returns not found when no current or Former Address is public", async () => {
        mocked.publishedPostAt.mockResolvedValue(undefined);

        await expect(PublicEntryPage({ params: Promise.resolve({ path: ["missing"] }) })).rejects.toThrow("not found");

        expect(mocked.notFound).toHaveBeenCalledOnce();
        expect(mocked.permanentRedirect).not.toHaveBeenCalled();
    });
});

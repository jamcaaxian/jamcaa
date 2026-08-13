import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    list: vi.fn(),
    categoryBySlug: vi.fn(),
    tagBySlug: vi.fn(),
    publicSiteSettings: vi.fn()
}));

vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@/content/store", () => ({ postSummaries: () => ({ list: mocked.list }) }));
vi.mock("@/content/taxonomy", () => ({
    taxonomy: () => ({ categoryBySlug: mocked.categoryBySlug, tagBySlug: mocked.tagBySlug })
}));
vi.mock("@/content/public-site", () => ({ publicSiteSettings: mocked.publicSiteSettings }));

import { GET as routeGet } from "@/app/api/public/posts/route";

const GET = routeGet as (request: Request) => Promise<Response>;

function summary() {
    return {
        id: "entry-1",
        slug: "hello",
        status: "published" as const,
        authorId: "author-1",
        categoryId: "category-1",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-02T00:00:00.000Z"),
        publishedAt: new Date("2026-08-03T00:00:00.000Z"),
        title: "Hello",
        excerpt: "A short summary"
    };
}

describe("the public Post listing HTTP route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.categoryBySlug.mockResolvedValue(undefined);
        mocked.tagBySlug.mockResolvedValue(undefined);
        mocked.publicSiteSettings.mockResolvedValue({
            get: (key: string) =>
                ({ "permalink.post": "/{year}/{month}/{slug}", "format.date": "yyyy-MM-dd", "format.time": "HH:mm" })[
                    key
                ]
        });
        mocked.list.mockResolvedValue({ summaries: [summary()], nextCursor: "next cursor" });
    });

    it("returns one published Summary page with canonical navigation addresses", async () => {
        mocked.categoryBySlug.mockResolvedValue({ id: "category-1", slug: "guides", name: "Guides" });

        const response = await GET(
            new Request("http://localhost/api/public/posts?category=guides&cursor=current%20cursor")
        );
        const answer = (await response.json()) as Record<string, unknown>;

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(answer).toMatchObject({
            pageAddress: "/category/guides?cursor=current+cursor",
            items: [{ id: "entry-1", address: "/2026/08/hello", title: "Hello", excerpt: "A short summary" }],
            next: {
                pageAddress: "/category/guides?cursor=next+cursor",
                dataAddress: "/api/public/posts?category=guides&cursor=next+cursor"
            }
        });
        expect(JSON.stringify(answer)).not.toContain("body");
        expect(mocked.list).toHaveBeenCalledWith({
            categoryId: "category-1",
            tagId: undefined,
            limit: 20,
            cursor: "current cursor"
        });
    });

    it("rejects ambiguous, missing, unknown, and forged page addresses", async () => {
        expect((await GET(new Request("http://localhost/api/public/posts"))).status).toBe(400);
        expect(
            (await GET(new Request("http://localhost/api/public/posts?category=guides&tag=featured&cursor=page")))
                .status
        ).toBe(400);
        expect((await GET(new Request("http://localhost/api/public/posts?category=&cursor=page"))).status).toBe(400);
        expect((await GET(new Request("http://localhost/api/public/posts?tag=&cursor=page"))).status).toBe(400);
        expect((await GET(new Request("http://localhost/api/public/posts?cursor=one&cursor=two"))).status).toBe(400);
        expect((await GET(new Request("http://localhost/api/public/posts?category=missing&cursor=page"))).status).toBe(
            404
        );

        mocked.list.mockRejectedValue(new Error("The Entry Summary cursor is invalid."));
        expect((await GET(new Request("http://localhost/api/public/posts?cursor=forged"))).status).toBe(404);
    });
});

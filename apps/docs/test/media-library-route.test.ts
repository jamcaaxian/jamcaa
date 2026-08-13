import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ getSession: vi.fn(), may: vi.fn(), mediaRuntime: vi.fn(), listMedia: vi.fn() }));

vi.mock("@/lib/session", () => ({ getSession: mocked.getSession }));
vi.mock("@/lib/permissions", () => ({ may: mocked.may }));
vi.mock("@/lib/media", () => ({ mediaRuntime: mocked.mediaRuntime }));
vi.mock("@jamcaaxian/core/media", async importOriginal => ({
    ...(await importOriginal<typeof import("@jamcaaxian/core/media")>()),
    listMedia: mocked.listMedia
}));

import { GET as routeGet } from "@/app/api/media/route";

const GET = routeGet as (request: Request) => Promise<Response>;

describe("the Media library HTTP route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getSession.mockResolvedValue({ user: { id: "user-1", role: "admin" } });
        mocked.may.mockResolvedValue(true);
        mocked.mediaRuntime.mockReturnValue({ database: "database" });
        mocked.listMedia.mockResolvedValue([
            { id: "media-1", filename: "diagram.png", mimeType: "image/png", size: 24, alt: "Diagram" }
        ]);
    });

    it("returns stored images through stable Media addresses", async () => {
        const response = await GET(new Request("http://localhost/api/media?type=image&limit=20&offset=0"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            items: [
                {
                    id: "media-1",
                    filename: "diagram.png",
                    mimeType: "image/png",
                    size: 24,
                    alt: "Diagram",
                    address: "/media/media-1"
                }
            ]
        });
        expect(mocked.listMedia).toHaveBeenCalledWith("database", { limit: 20, offset: 0, mimePrefix: "image/" });
    });

    it("requires media read capability", async () => {
        mocked.may.mockResolvedValue(false);

        expect((await GET(new Request("http://localhost/api/media"))).status).toBe(403);
        expect(mocked.listMedia).not.toHaveBeenCalled();
    });
});

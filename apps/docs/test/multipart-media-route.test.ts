import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    getSession: vi.fn(),
    may: vi.fn(),
    mediaRuntime: vi.fn(),
    loadSettings: vi.fn(),
    planMultipartUpload: vi.fn(),
    recordMultipartPart: vi.fn(),
    completeMultipartUpload: vi.fn()
}));

vi.mock("@/lib/session", () => ({ getSession: mocked.getSession }));
vi.mock("@/lib/permissions", () => ({ may: mocked.may }));
vi.mock("@/lib/media", () => ({ mediaRuntime: mocked.mediaRuntime }));
vi.mock("@jamcaa/core/settings", () => ({ coreSettings: {}, loadSettings: mocked.loadSettings }));
vi.mock("@jamcaa/core/media", () => ({
    planMultipartUpload: mocked.planMultipartUpload,
    recordMultipartPart: mocked.recordMultipartPart,
    completeMultipartUpload: mocked.completeMultipartUpload
}));

import { PATCH as routePatch, POST as routePost, PUT as routePut } from "@/app/api/media/multipart/route";

const fiveMiB = 5 * 1024 * 1024;

function request(method: string, body: unknown) {
    return new Request("http://localhost/api/media/multipart", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}

const POST = routePost as (request: Request) => Promise<Response>;
const PATCH = routePatch as (request: Request) => Promise<Response>;
const PUT = routePut as (request: Request) => Promise<Response>;

describe("the multipart media HTTP route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.getSession.mockResolvedValue({ user: { id: "uploader-1", role: "admin" } });
        mocked.may.mockResolvedValue(true);
        mocked.mediaRuntime.mockReturnValue({
            database: "database",
            bindings: { MEDIA_BUCKET: "bucket" },
            credentials: { accountId: "account", accessKeyId: "key", secretAccessKey: "secret" }
        });
        mocked.loadSettings.mockResolvedValue({ get: () => 25 });
    });

    it("rejects preparation without a signed-in uploader", async () => {
        mocked.getSession.mockResolvedValue(null);

        const response = await POST(
            request("POST", { name: "movie.mp4", type: "video/mp4", size: 11 * 1024 * 1024, fingerprint: "movie" })
        );

        expect(response.status).toBe(401);
        expect(mocked.planMultipartUpload).not.toHaveBeenCalled();
    });

    it("prepares a five-MiB multipart plan for an authorized uploader", async () => {
        mocked.planMultipartUpload.mockResolvedValue({
            id: "media-1",
            completedParts: [],
            parts: [
                { partNumber: 1, offset: 0, size: fiveMiB, putUrl: "https://parts/1" },
                { partNumber: 2, offset: fiveMiB, size: fiveMiB, putUrl: "https://parts/2" },
                { partNumber: 3, offset: 2 * fiveMiB, size: 1024 * 1024, putUrl: "https://parts/3" }
            ]
        });

        const response = await POST(
            request("POST", { name: "movie.mp4", type: "video/mp4", size: 11 * 1024 * 1024, fingerprint: "movie" })
        );

        expect(response.status).toBe(200);
        const answer = (await response.json()) as { id: string; parts: Array<{ partNumber: number }> };
        expect(answer.id).toBe("media-1");
        expect(answer.parts.map(part => part.partNumber)).toEqual([1, 2, 3]);
        expect(mocked.planMultipartUpload).toHaveBeenCalledWith(
            expect.objectContaining({
                uploaderId: "uploader-1",
                fingerprint: "movie",
                partSize: fiveMiB,
                expiresInSeconds: 300
            })
        );
    });

    it("records a browser part ETag", async () => {
        const response = await PATCH(request("PATCH", { id: "media-1", partNumber: 2, etag: '"part-two"' }));

        expect(response.status).toBe(204);
        expect(mocked.recordMultipartPart).toHaveBeenCalledWith({
            database: "database",
            id: "media-1",
            uploaderId: "uploader-1",
            part: { partNumber: 2, etag: '"part-two"' }
        });
    });

    it("returns a conflict while a multipart upload still has missing parts", async () => {
        mocked.completeMultipartUpload.mockRejectedValue(new Error("The multipart upload still has unfinished parts."));

        const response = await PUT(request("PUT", { id: "media-1" }));

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: "The multipart upload still has unfinished parts." });
    });

    it("publishes the media after all parts are complete", async () => {
        mocked.completeMultipartUpload.mockResolvedValue({ id: "media-1", filename: "movie.mp4" });

        const response = await PUT(request("PUT", { id: "media-1" }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            id: "media-1",
            filename: "movie.mp4",
            address: "/media/media-1"
        });
    });
});

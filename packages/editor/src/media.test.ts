import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpMediaAdapter, EditorMediaError } from "./media";

describe("the default HTTP Media adapter", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports a stable code while retaining the server detail for diagnostics", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ error: "Bucket credentials expired." }, { status: 503 }))
        );

        const adapter = createHttpMediaAdapter();

        await expect(adapter.listImages?.()).rejects.toMatchObject({
            name: "EditorMediaError",
            code: "media-unavailable",
            detail: "Bucket credentials expired."
        } satisfies Partial<EditorMediaError>);
    });

    it("wraps transport failures in the same stable error contract", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("network offline");
            })
        );

        const adapter = createHttpMediaAdapter();

        await expect(adapter.listImages?.()).rejects.toMatchObject({
            name: "EditorMediaError",
            code: "media-unavailable",
            detail: "network offline",
            cause: expect.any(TypeError)
        } satisfies Partial<EditorMediaError>);
    });

    it("rejects malformed Media items returned with a successful status", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ items: [{ id: "media", filename: "cat.png", address: "/media/media" }] }))
        );

        const adapter = createHttpMediaAdapter();

        await expect(adapter.listImages?.()).rejects.toMatchObject({
            name: "EditorMediaError",
            code: "media-unavailable",
            detail: expect.stringMatching(/invalid media response/i)
        } satisfies Partial<EditorMediaError>);
    });

    it("rejects malformed multipart plans returned with a successful status", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(Response.json({ mode: "multipart" }))
                .mockResolvedValueOnce(
                    Response.json({ id: "upload", completedParts: [], parts: [{ partNumber: 1, offset: 0, size: 6 }] })
                )
        );
        vi.stubGlobal("crypto", { subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });

        const adapter = createHttpMediaAdapter();

        await expect(
            adapter.uploadImage?.(new File([new Uint8Array(6)], "cat.png", { type: "image/png" }))
        ).rejects.toMatchObject({
            name: "EditorMediaError",
            code: "image-upload-failed",
            detail: expect.stringMatching(/invalid multipart preparation response/i)
        } satisfies Partial<EditorMediaError>);
    });
});

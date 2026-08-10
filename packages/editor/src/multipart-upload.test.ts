import { describe, expect, it, vi } from "vitest";
import { fileFingerprint, uploadMultipart, uploadMultipartWithFallback } from "./multipart-upload";

describe("uploading a file in resumable parts", () => {
    it("uses file content rather than metadata alone for the resume fingerprint", async () => {
        const metadata = { type: "video/mp4", lastModified: 1 };
        const first = new File([new Uint8Array([1, 2, 3])], "movie.mp4", metadata);
        const second = new File([new Uint8Array([3, 2, 1])], "movie.mp4", metadata);

        expect(await fileFingerprint(first)).not.toBe(await fileFingerprint(second));
    });

    it("skips completed parts and retries a failed missing part", async () => {
        const file = new File([new Uint8Array(11)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const uploadPart = vi
            .fn<(part: { partNumber: number }) => Promise<string>>()
            .mockRejectedValueOnce(new Error("connection lost"))
            .mockResolvedValueOnce('"part-two"')
            .mockResolvedValueOnce('"part-three"');
        const recordPart = vi.fn(async () => undefined);

        await uploadMultipart({
            file,
            plan: {
                id: "media-1",
                completedParts: [{ partNumber: 1, etag: '"part-one"' }],
                parts: [
                    { partNumber: 2, offset: 5, size: 5, putUrl: "https://parts/2" },
                    { partNumber: 3, offset: 10, size: 1, putUrl: "https://parts/3" }
                ]
            },
            uploadPart,
            recordPart,
            concurrency: 1,
            retryDelayMilliseconds: 0
        });

        expect(uploadPart.mock.calls.map(([part]) => part.partNumber)).toEqual([2, 2, 3]);
        expect(recordPart).toHaveBeenNthCalledWith(1, { partNumber: 2, etag: '"part-two"' });
        expect(recordPart).toHaveBeenNthCalledWith(2, { partNumber: 3, etag: '"part-three"' });
    });

    it("uploads three parts at a time while recording their ETags one at a time", async () => {
        const file = new File([new Uint8Array(20)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        let activeUploads = 0;
        let busiestUploads = 0;
        let activeRecords = 0;
        let busiestRecords = 0;

        await uploadMultipart({
            file,
            plan: {
                id: "media-1",
                completedParts: [],
                parts: Array.from({ length: 4 }, (_, index) => ({
                    partNumber: index + 1,
                    offset: index * 5,
                    size: 5,
                    putUrl: `https://parts/${index + 1}`
                }))
            },
            concurrency: 3,
            uploadPart: async part => {
                activeUploads += 1;
                busiestUploads = Math.max(busiestUploads, activeUploads);
                await new Promise(resolve => setTimeout(resolve, 1));
                activeUploads -= 1;
                return `"part-${part.partNumber}"`;
            },
            recordPart: async () => {
                activeRecords += 1;
                busiestRecords = Math.max(busiestRecords, activeRecords);
                await new Promise(resolve => setTimeout(resolve, 1));
                activeRecords -= 1;
            }
        });

        expect(busiestUploads).toBe(3);
        expect(busiestRecords).toBe(1);
    });

    it("refreshes expired part addresses and skips parts already recorded by the server", async () => {
        const file = new File([new Uint8Array(6)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const prepare = vi
            .fn<
                () => Promise<{
                    id: string;
                    completedParts: Array<{ partNumber: number; etag: string }>;
                    parts: Array<{ partNumber: number; offset: number; size: number; putUrl: string }>;
                }>
            >()
            .mockResolvedValueOnce({
                id: "media-1",
                completedParts: [],
                parts: [
                    { partNumber: 1, offset: 0, size: 3, putUrl: "https://expired/1" },
                    { partNumber: 2, offset: 3, size: 3, putUrl: "https://expired/2" }
                ]
            })
            .mockResolvedValueOnce({
                id: "media-1",
                completedParts: [{ partNumber: 1, etag: '"part-one"' }],
                parts: [{ partNumber: 2, offset: 3, size: 3, putUrl: "https://fresh/2" }]
            });
        const uploadPart = vi.fn(async (part: { partNumber: number; putUrl: string }) => {
            if (part.partNumber === 2 && part.putUrl === "https://expired/2") {
                throw new Error("address expired");
            }

            return `"part-${part.partNumber}"`;
        });
        const uploadServer = vi.fn(async () => "duplicate");

        const result = await uploadMultipartWithFallback({
            file,
            prepare,
            uploadPart,
            recordPart: vi.fn(async () => undefined),
            complete: vi.fn(async () => "stored"),
            uploadServer,
            attempts: 1,
            planAttempts: 2,
            retryDelayMilliseconds: 0
        });

        expect(result).toEqual({ mode: "multipart", value: "stored" });
        expect(prepare).toHaveBeenCalledTimes(2);
        expect(uploadPart.mock.calls.map(([part]) => part.putUrl)).toEqual([
            "https://expired/1",
            "https://expired/2",
            "https://fresh/2"
        ]);
        expect(uploadServer).not.toHaveBeenCalled();
    });

    it("uses the server path only after preparation confirms multipart was not established", async () => {
        const file = new File([new Uint8Array(6)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const uploadServer = vi.fn(async () => "stored");

        const result = await uploadMultipartWithFallback({
            file,
            prepare: vi.fn(async () => ({ fallback: "server" as const })),
            uploadPart: vi.fn(async () => '"part-one"'),
            recordPart: vi.fn(async () => undefined),
            complete: vi.fn(async () => "multipart"),
            uploadServer,
            retryDelayMilliseconds: 0
        });

        expect(result).toEqual({ mode: "server", value: "stored" });
        expect(uploadServer).toHaveBeenCalledWith(file);
    });

    it("does not fall back when the first multipart preparation result is uncertain", async () => {
        const file = new File([new Uint8Array(6)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const uploadServer = vi.fn(async () => "duplicate");

        await expect(
            uploadMultipartWithFallback({
                file,
                prepare: vi.fn(async () => {
                    throw new Error("preparation response lost");
                }),
                uploadPart: vi.fn(async () => '"part-one"'),
                recordPart: vi.fn(async () => undefined),
                complete: vi.fn(async () => "stored"),
                uploadServer,
                retryDelayMilliseconds: 0
            })
        ).rejects.toThrow("preparation response lost");
        expect(uploadServer).not.toHaveBeenCalled();
    });

    it("does not send the whole file through the server after multipart was established", async () => {
        const file = new File([new Uint8Array(6)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const uploadServer = vi.fn(async () => "duplicate");

        await expect(
            uploadMultipartWithFallback({
                file,
                prepare: vi.fn(async () => ({
                    id: "media-1",
                    completedParts: [],
                    parts: [{ partNumber: 1, offset: 0, size: 6, putUrl: "https://parts/1" }]
                })),
                uploadPart: vi.fn(async () => {
                    throw new Error("connection lost");
                }),
                recordPart: vi.fn(async () => undefined),
                complete: vi.fn(async () => "stored"),
                uploadServer,
                attempts: 1,
                planAttempts: 2,
                retryDelayMilliseconds: 0
            })
        ).rejects.toThrow("connection lost");
        expect(uploadServer).not.toHaveBeenCalled();
    });

    it("does not create a second upload when multipart completion is uncertain", async () => {
        const file = new File([new Uint8Array(6)], "movie.mp4", { type: "video/mp4", lastModified: 1 });
        const uploadServer = vi.fn(async () => "duplicate");
        const prepare = vi.fn(async () => ({
            id: "media-1",
            completedParts: [],
            parts: [{ partNumber: 1, offset: 0, size: 6, putUrl: "https://parts/1" }]
        }));

        await expect(
            uploadMultipartWithFallback({
                file,
                prepare,
                uploadPart: vi.fn(async () => '"part-one"'),
                recordPart: vi.fn(async () => undefined),
                complete: vi.fn(async () => {
                    throw new Error("completion response lost");
                }),
                uploadServer,
                retryDelayMilliseconds: 0
            })
        ).rejects.toThrow("completion response lost");
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(uploadServer).not.toHaveBeenCalled();
    });
});

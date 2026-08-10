import { fileFingerprint, uploadMultipartWithFallback, type MultipartUploadPlan } from "./multipart-upload";

export interface EditorMediaItem {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    alt: string | null;
    address: string;
}

export interface EditorMediaProgress {
    completedBytes: number;
    totalBytes: number;
}

export interface UploadImageOptions {
    onProgress?(progress: EditorMediaProgress): void;
    onConfirming?(): void;
}

export interface RichTextMediaAdapter {
    address(mediaId: string): string;
    listImages?(): Promise<readonly EditorMediaItem[]>;
    uploadImage?(file: File, options?: UploadImageOptions): Promise<EditorMediaItem>;
}

export interface HttpMediaAdapterOptions {
    collection?: string;
    apiBase?: string;
    mediaBase?: string;
    imageLimit?: number;
}

export type EditorMediaErrorCode = "media-unavailable" | "image-upload-failed";

export class EditorMediaError extends Error {
    readonly code: EditorMediaErrorCode;
    readonly detail?: string;

    constructor(code: EditorMediaErrorCode, detail?: string, options?: ErrorOptions) {
        super(code, options);
        this.name = "EditorMediaError";
        this.code = code;
        this.detail = detail;
    }
}

interface DirectUploadAnswer {
    mode?: "multipart" | "server";
    error?: string;
}

interface MultipartPreparationAnswer extends Partial<MultipartUploadPlan> {
    fallback?: "server";
    error?: string;
}

function path(base: string, suffix = "") {
    return `${base.replace(/\/$/, "")}${suffix}`;
}

function diagnostic(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function asMediaError(error: unknown, code: EditorMediaErrorCode) {
    return error instanceof EditorMediaError ? error : new EditorMediaError(code, diagnostic(error), { cause: error });
}

function record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value) ?
            (value as Record<string, unknown>)
        :   undefined;
}

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function mediaItem(value: unknown): EditorMediaItem | undefined {
    const candidate = record(value);

    if (
        !candidate
        || !nonEmptyString(candidate.id)
        || !nonEmptyString(candidate.filename)
        || !nonEmptyString(candidate.mimeType)
        || typeof candidate.size !== "number"
        || !Number.isSafeInteger(candidate.size)
        || candidate.size < 0
        || (candidate.alt !== null && typeof candidate.alt !== "string")
        || !nonEmptyString(candidate.address)
    ) {
        return undefined;
    }

    return {
        id: candidate.id,
        filename: candidate.filename,
        mimeType: candidate.mimeType,
        size: candidate.size,
        alt: candidate.alt,
        address: candidate.address
    };
}

function multipartPlan(value: unknown): MultipartUploadPlan | { fallback: "server" } | undefined {
    const candidate = record(value);

    if (candidate?.fallback === "server") {
        return { fallback: "server" };
    }

    if (
        !candidate
        || !nonEmptyString(candidate.id)
        || !Array.isArray(candidate.completedParts)
        || !Array.isArray(candidate.parts)
    ) {
        return undefined;
    }

    const completedParts = candidate.completedParts.map(part => {
        const parsed = record(part);
        return (
                parsed
                    && typeof parsed.partNumber === "number"
                    && Number.isSafeInteger(parsed.partNumber)
                    && parsed.partNumber > 0
                    && nonEmptyString(parsed.etag)
            ) ?
                { partNumber: parsed.partNumber, etag: parsed.etag }
            :   undefined;
    });
    const parts = candidate.parts.map(part => {
        const parsed = record(part);
        return (
                parsed
                    && typeof parsed.partNumber === "number"
                    && Number.isSafeInteger(parsed.partNumber)
                    && parsed.partNumber > 0
                    && typeof parsed.offset === "number"
                    && Number.isSafeInteger(parsed.offset)
                    && parsed.offset >= 0
                    && typeof parsed.size === "number"
                    && Number.isSafeInteger(parsed.size)
                    && parsed.size > 0
                    && nonEmptyString(parsed.putUrl)
            ) ?
                { partNumber: parsed.partNumber, offset: parsed.offset, size: parsed.size, putUrl: parsed.putUrl }
            :   undefined;
    });

    if (completedParts.some(part => part === undefined) || parts.some(part => part === undefined)) {
        return undefined;
    }

    return {
        id: candidate.id,
        completedParts: completedParts as MultipartUploadPlan["completedParts"],
        parts: parts as MultipartUploadPlan["parts"]
    };
}

async function mediaOperation<T>(code: EditorMediaErrorCode, operation: () => Promise<T>) {
    try {
        return await operation();
    } catch (error) {
        throw asMediaError(error, code);
    }
}

async function mediaAnswer(response: Response, code: EditorMediaErrorCode): Promise<EditorMediaItem> {
    const raw = (await response.json().catch(() => ({}))) as unknown;
    const answer = record(raw);
    const item = mediaItem(raw);

    if (!response.ok || item === undefined) {
        throw new EditorMediaError(
            code,
            typeof answer?.error === "string" ? answer.error : `Invalid Media response; HTTP ${response.status}`
        );
    }

    return item;
}

export function createHttpMediaAdapter(options: HttpMediaAdapterOptions = {}): RichTextMediaAdapter {
    const apiBase = path(options.apiBase ?? "/api/media");
    const mediaBase = path(options.mediaBase ?? "/media");
    const imageLimit = Math.max(1, Math.floor(options.imageLimit ?? 60));

    async function uploadThroughServer(file: File) {
        const body = new FormData();
        body.set("file", file);

        if (options.collection) body.set("collection", options.collection);

        return mediaAnswer(await fetch(apiBase, { method: "POST", body }), "image-upload-failed");
    }

    return {
        address: mediaId => path(mediaBase, `/${encodeURIComponent(mediaId)}`),
        async listImages() {
            return mediaOperation("media-unavailable", async () => {
                const query = new URLSearchParams({ type: "image", limit: String(imageLimit) });
                const response = await fetch(`${apiBase}?${query}`);
                const raw = (await response.json().catch(() => ({}))) as unknown;
                const answer = record(raw);
                const items = Array.isArray(answer?.items) ? answer.items.map(mediaItem) : undefined;

                if (!response.ok || items === undefined || items.some(item => item === undefined)) {
                    throw new EditorMediaError(
                        "media-unavailable",
                        typeof answer?.error === "string" ?
                            answer.error
                        :   `Invalid Media response; HTTP ${response.status}`
                    );
                }

                return items as EditorMediaItem[];
            });
        },
        async uploadImage(file, uploadOptions = {}) {
            return mediaOperation("image-upload-failed", async () => {
                const preparation = await fetch(apiBase, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        collection: options.collection
                    })
                });
                const transfer = (await preparation.json().catch(() => ({}))) as DirectUploadAnswer;

                if (!preparation.ok) {
                    throw new EditorMediaError("image-upload-failed", transfer.error ?? `HTTP ${preparation.status}`);
                }

                if (transfer.mode !== "multipart") {
                    return uploadThroughServer(file);
                }

                const fingerprint = await fileFingerprint(file);
                let currentMultipartId = "";
                const result = await uploadMultipartWithFallback({
                    file,
                    prepare: async () => {
                        const response = await fetch(path(apiBase, "/multipart"), {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                fingerprint,
                                collection: options.collection
                            })
                        });
                        const raw = (await response.json().catch(() => ({}))) as unknown;
                        const answer = record(raw) as MultipartPreparationAnswer | undefined;
                        const plan = multipartPlan(raw);

                        if (response.ok && plan && "fallback" in plan) {
                            return plan;
                        }

                        if (!response.ok || plan === undefined || "fallback" in plan) {
                            throw new EditorMediaError(
                                "image-upload-failed",
                                answer?.error ?? `Invalid multipart preparation response; HTTP ${response.status}`
                            );
                        }

                        currentMultipartId = plan.id;
                        return plan;
                    },
                    uploadPart: async (part, body) => {
                        const response = await fetch(part.putUrl, { method: "PUT", body });
                        const etag = response.headers.get("etag");

                        if (!response.ok || !etag) {
                            throw new EditorMediaError(
                                "image-upload-failed",
                                `Part ${part.partNumber} returned HTTP ${response.status} without an ETag.`
                            );
                        }

                        return etag;
                    },
                    recordPart: async part => {
                        if (!currentMultipartId) {
                            throw new EditorMediaError(
                                "image-upload-failed",
                                "The multipart upload identifier is missing."
                            );
                        }

                        const response = await fetch(path(apiBase, "/multipart"), {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: currentMultipartId, ...part })
                        });

                        if (!response.ok) {
                            throw new EditorMediaError(
                                "image-upload-failed",
                                `Part ${part.partNumber} could not be recorded; HTTP ${response.status}.`
                            );
                        }
                    },
                    onProgress: uploadOptions.onProgress,
                    complete: async id => {
                        uploadOptions.onConfirming?.();
                        return mediaAnswer(
                            await fetch(path(apiBase, "/multipart"), {
                                method: "PUT",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id })
                            }),
                            "image-upload-failed"
                        );
                    },
                    uploadServer: uploadThroughServer
                });

                return result.value;
            });
        }
    };
}

import { fileFingerprint, uploadMultipartWithFallback, type MultipartUploadPlan } from "./multipart-upload";

export interface StoredMediaAnswer {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    alt: string | null;
    address: string;
}

export interface MediaUploadProgress {
    completedBytes: number;
    totalBytes: number;
}

export interface UploadMediaOptions {
    collection?: string;
    onProgress?(progress: MediaUploadProgress): void;
    onConfirming?(): void;
}

interface DirectUploadAnswer {
    mode?: "multipart" | "server";
    error?: string;
}

async function answerFrom(response: Response): Promise<StoredMediaAnswer> {
    const answer = (await response.json().catch(() => ({}))) as Partial<StoredMediaAnswer> & { error?: string };

    if (!response.ok || !answer.id || !answer.address || !answer.filename) {
        throw new Error(answer.error ?? `The server answered ${response.status}.`);
    }

    return {
        id: answer.id,
        filename: answer.filename,
        mimeType: answer.mimeType ?? "application/octet-stream",
        size: answer.size ?? 0,
        alt: answer.alt ?? null,
        address: answer.address
    };
}

async function uploadThroughServer(file: File, collection?: string) {
    const body = new FormData();
    body.set("file", file);

    if (collection) body.set("collection", collection);

    return answerFrom(await fetch("/api/media", { method: "POST", body }));
}

export async function uploadMedia(file: File, options: UploadMediaOptions = {}): Promise<StoredMediaAnswer> {
    const preparation = await fetch("/api/media", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size, collection: options.collection })
    });
    const transfer = (await preparation.json().catch(() => ({}))) as DirectUploadAnswer;

    if (!preparation.ok) {
        throw new Error(transfer.error ?? `The server answered ${preparation.status}.`);
    }

    if (transfer.mode !== "multipart") {
        return uploadThroughServer(file, options.collection);
    }

    let currentMultipartId = "";
    const result = await uploadMultipartWithFallback({
        file,
        prepare: async () => {
            const response = await fetch("/api/media/multipart", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    fingerprint: fileFingerprint(file),
                    collection: options.collection
                })
            });
            const answer = (await response.json().catch(() => ({}))) as MultipartUploadPlan & { error?: string };

            if (!response.ok || !answer.id || !Array.isArray(answer.parts)) {
                throw new Error(answer.error ?? `Multipart preparation answered ${response.status}.`);
            }

            currentMultipartId = answer.id;
            return answer;
        },
        uploadPart: async (part, body) => {
            const response = await fetch(part.putUrl, { method: "PUT", body });
            const etag = response.headers.get("etag");

            if (!response.ok || !etag) {
                throw new Error(`Part ${part.partNumber} could not be stored.`);
            }

            return etag;
        },
        recordPart: async part => {
            if (!currentMultipartId) throw new Error("The multipart upload identifier is missing.");

            const response = await fetch("/api/media/multipart", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: currentMultipartId, ...part })
            });

            if (!response.ok) throw new Error(`Part ${part.partNumber} could not be recorded.`);
        },
        onProgress: options.onProgress,
        complete: async id => {
            options.onConfirming?.();
            return answerFrom(
                await fetch("/api/media/multipart", {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id })
                })
            );
        },
        uploadServer: fallbackFile => uploadThroughServer(fallbackFile, options.collection)
    });

    return result.value;
}

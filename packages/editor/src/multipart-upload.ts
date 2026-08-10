export interface MultipartPartPlan {
    partNumber: number;
    offset: number;
    size: number;
    putUrl: string;
}

export interface CompletedMultipartPart {
    partNumber: number;
    etag: string;
}

export interface MultipartUploadPlan {
    id: string;
    completedParts: CompletedMultipartPart[];
    parts: MultipartPartPlan[];
}

export interface MultipartUploadProgress {
    completedBytes: number;
    totalBytes: number;
    completedParts: number;
    totalParts: number;
}

interface MultipartUploadOptions {
    file: File;
    plan: MultipartUploadPlan;
    uploadPart(part: MultipartPartPlan, body: Blob): Promise<string>;
    recordPart(part: CompletedMultipartPart): Promise<void>;
    onProgress?(progress: MultipartUploadProgress): void;
    attempts?: number;
    concurrency?: number;
    retryDelayMilliseconds?: number;
}

interface MultipartUploadWithFallbackOptions<TResult> extends Omit<MultipartUploadOptions, "plan"> {
    prepare(): Promise<MultipartUploadPlan | { fallback: "server" }>;
    complete(id: string): Promise<TResult>;
    uploadServer(file: File): Promise<TResult>;
    planAttempts?: number;
}

const FINGERPRINT_CHUNK_SIZE = 4 * 1024 * 1024;

function hexadecimal(bytes: ArrayBuffer) {
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function fileFingerprint(file: File) {
    const chunkDigests: Uint8Array[] = [];

    for (let offset = 0; offset < file.size; offset += FINGERPRINT_CHUNK_SIZE) {
        const chunk = await file.slice(offset, offset + FINGERPRINT_CHUNK_SIZE).arrayBuffer();
        chunkDigests.push(new Uint8Array(await crypto.subtle.digest("SHA-256", chunk)));
    }

    const digestInput = new Uint8Array(chunkDigests.length * 32);
    chunkDigests.forEach((digest, index) => digestInput.set(digest, index * 32));
    const digest = await crypto.subtle.digest("SHA-256", digestInput);

    return `sha256-tree-v1:${hexadecimal(digest)}`;
}

function pause(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function retry<T>(work: () => Promise<T>, attempts: number, delayMilliseconds: number) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await work();
        } catch (error) {
            lastError = error;

            if (attempt < attempts && delayMilliseconds > 0) {
                await pause(delayMilliseconds * 2 ** (attempt - 1));
            }
        }
    }

    throw lastError;
}

export async function uploadMultipart(options: MultipartUploadOptions): Promise<void> {
    const {
        file,
        plan,
        uploadPart,
        recordPart,
        onProgress,
        attempts = 3,
        concurrency = 3,
        retryDelayMilliseconds = 250
    } = options;
    const completed = new Set(plan.completedParts.map(part => part.partNumber));
    const totalParts = completed.size + plan.parts.length;
    const missingBytes = plan.parts.reduce((bytes, part) => bytes + part.size, 0);
    let completedBytes = Math.max(0, file.size - missingBytes);
    let recordQueue = Promise.resolve();

    onProgress?.({ completedBytes, totalBytes: file.size, completedParts: completed.size, totalParts });

    const send = async (part: MultipartPartPlan) => {
        const body = file.slice(part.offset, part.offset + part.size);
        const etag = await retry(() => uploadPart(part, body), attempts, retryDelayMilliseconds);

        recordQueue = recordQueue.then(() =>
            retry(() => recordPart({ partNumber: part.partNumber, etag }), attempts, retryDelayMilliseconds)
        );
        await recordQueue;
        completed.add(part.partNumber);
        completedBytes = Math.min(file.size, completedBytes + part.size);
        onProgress?.({ completedBytes, totalBytes: file.size, completedParts: completed.size, totalParts });
    };
    const workerCount = Math.max(1, Math.min(Math.floor(concurrency), plan.parts.length));
    let nextPart = 0;
    let failure: unknown;

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextPart < plan.parts.length && failure === undefined) {
                const part = plan.parts[nextPart];
                nextPart += 1;

                if (part !== undefined) {
                    try {
                        await send(part);
                    } catch (error) {
                        failure ??= error;
                    }
                }
            }
        })
    );

    if (failure !== undefined) {
        throw failure;
    }
}

export interface MultipartUploadResult<TResult> {
    mode: "multipart" | "server";
    value: TResult;
}

export async function uploadMultipartWithFallback<TResult>(
    options: MultipartUploadWithFallbackOptions<TResult>
): Promise<MultipartUploadResult<TResult>> {
    const { prepare, complete, uploadServer, planAttempts = 3, ...uploadOptions } = options;
    let prepared = await prepare();

    if ("fallback" in prepared) {
        return { mode: "server", value: await uploadServer(options.file) };
    }

    let plan = prepared;
    const rounds = Math.max(1, Math.floor(planAttempts));

    for (let round = 1; round <= rounds; round += 1) {
        try {
            await uploadMultipart({ ...uploadOptions, plan });
            break;
        } catch (error) {
            if (round === rounds) {
                throw error;
            }

            prepared = await prepare();

            if ("fallback" in prepared) {
                throw error;
            }

            plan = prepared;
        }
    }

    return { mode: "multipart", value: await complete(plan.id) };
}

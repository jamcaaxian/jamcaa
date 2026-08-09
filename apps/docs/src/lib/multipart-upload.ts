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

interface MultipartUploadWithFallbackOptions extends Omit<MultipartUploadOptions, "plan"> {
    prepare(): Promise<MultipartUploadPlan>;
    complete(id: string): Promise<void>;
    uploadServer(file: File): Promise<void>;
}

export function fileFingerprint(file: Pick<File, "name" | "size" | "type" | "lastModified">) {
    return `${file.name}:${file.size}:${file.type || "application/octet-stream"}:${file.lastModified}`;
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

export async function uploadMultipartWithFallback(
    options: MultipartUploadWithFallbackOptions
): Promise<"multipart" | "server"> {
    const { prepare, complete, uploadServer, ...uploadOptions } = options;

    try {
        const plan = await prepare();
        await uploadMultipart({ ...uploadOptions, plan });
        await complete(plan.id);
        return "multipart";
    } catch (error) {
        try {
            await uploadServer(options.file);
            return "server";
        } catch {
            throw error;
        }
    }
}

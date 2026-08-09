import { AwsClient } from "aws4fetch";

export interface BucketRecord {
    id: string;
    kind: "binding" | "s3";
    binding: string | null;
    endpoint: string | null;
    region: string | null;
    bucketName: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    publicUrl: string | null;
}

export interface SigningCredentials {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
}

export interface FetchedObject {
    body: ReadableStream;
    mimeType: string;
    size: number;
}

export interface StoredObjectMetadata {
    mimeType: string;
    size: number;
}

export interface StorageAdapter {
    put(key: string, body: ReadableStream | ArrayBuffer | Blob, mimeType: string): Promise<void>;
    /** Undefined when the bucket has no such object. */
    get(key: string): Promise<FetchedObject | undefined>;
    /** Undefined when the bucket has no such object. */
    head(key: string): Promise<StoredObjectMetadata | undefined>;
    remove(key: string): Promise<void>;
    /** Undefined when the bucket is not served publicly and the app must stream it. */
    publicAddress(key: string): string | undefined;
    /** Undefined when this bucket cannot hand the browser an address to write to. */
    presignPut?(key: string, mimeType: string, expiresInSeconds: number): Promise<string>;
}

interface S3Access {
    client: AwsClient;
    addressOf(key: string): string;
}

function s3AccessFor(record: BucketRecord, credentials?: SigningCredentials): S3Access | undefined {
    const usesOwnCredentials = record.kind === "s3";
    const accessKeyId = usesOwnCredentials ? record.accessKeyId : credentials?.accessKeyId;
    const secretAccessKey = usesOwnCredentials ? record.secretAccessKey : credentials?.secretAccessKey;

    // A bucket reached through a binding still has an S3 endpoint, which is the only
    // way to hand the browser an address it may write to itself.
    const endpoint =
        usesOwnCredentials ? record.endpoint
        : credentials ? `https://${credentials.accountId}.r2.cloudflarestorage.com`
        : null;

    if (!accessKeyId || !secretAccessKey || !endpoint || !record.bucketName) {
        return undefined;
    }

    return {
        // R2 has one region; another S3-compatible endpoint may name its own.
        client: new AwsClient({ accessKeyId, secretAccessKey, region: record.region ?? "auto", service: "s3" }),
        addressOf: key => `${endpoint.replace(/\/$/, "")}/${record.bucketName}/${encodeURI(key)}`
    };
}

function presignerFor(access: S3Access) {
    return async (key: string, mimeType: string, expiresInSeconds: number) => {
        const url = new URL(access.addressOf(key));

        url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));

        const signed = await access.client.sign(url.toString(), {
            method: "PUT",
            headers: { "content-type": mimeType },
            aws: { signQuery: true }
        });

        return signed.url;
    };
}

/**
 * One interface over both ways of reaching a bucket. Buckets in this account go
 * through the binding, which is faster and free of egress charges; anything added
 * afterwards is reached by signing. See docs/adr/0005.
 */
export function createStorageAdapter(options: {
    record: BucketRecord;
    /** The Worker's bindings, for a bucket that has one. */
    bindings?: Record<string, unknown>;
    /** Used to sign for a bucket of this account, which keeps no credentials of its own. */
    credentials?: SigningCredentials;
}): StorageAdapter {
    const { record, bindings, credentials } = options;
    const access = s3AccessFor(record, credentials);
    const presignPut = access ? presignerFor(access) : undefined;

    const publicAddress = (key: string) =>
        record.publicUrl ? `${record.publicUrl.replace(/\/$/, "")}/${encodeURI(key)}` : undefined;

    if (record.kind === "binding") {
        const target = record.binding ? bindings?.[record.binding] : undefined;

        if (!isR2Bucket(target)) {
            throw new Error(
                `Bucket "${record.id}" expects a binding named "${record.binding}", which this Worker does not have.`
            );
        }

        return {
            put: async (key, body, mimeType) => {
                await target.put(key, body, { httpMetadata: { contentType: mimeType } });
            },
            get: async key => {
                const object = await target.get(key);

                return object === null ? undefined : (
                        {
                            body: object.body,
                            mimeType: object.httpMetadata?.contentType ?? "application/octet-stream",
                            size: object.size
                        }
                    );
            },
            head: async key => {
                const object = await target.head(key);

                return object === null ? undefined : (
                        { mimeType: object.httpMetadata?.contentType ?? "application/octet-stream", size: object.size }
                    );
            },
            remove: async key => {
                await target.delete(key);
            },
            publicAddress,
            ...(presignPut ? { presignPut } : {})
        };
    }

    if (access === undefined) {
        throw new Error(`Bucket "${record.id}" is missing the endpoint or credentials needed to reach it.`);
    }

    return {
        put: async (key, body, mimeType) => {
            const response = await access.client.fetch(access.addressOf(key), {
                method: "PUT",
                body: body as BodyInit,
                headers: { "content-type": mimeType }
            });

            if (!response.ok) {
                throw new Error(`Bucket "${record.id}" refused the upload: ${response.status}.`);
            }
        },
        remove: async key => {
            const response = await access.client.fetch(access.addressOf(key), { method: "DELETE" });

            // S3 answers a delete of something absent with 204, so only real faults throw.
            if (!response.ok && response.status !== 404) {
                throw new Error(`Bucket "${record.id}" refused the delete: ${response.status}.`);
            }
        },
        get: async key => {
            const response = await access.client.fetch(access.addressOf(key));

            return response.ok && response.body ?
                    {
                        body: response.body,
                        mimeType: response.headers.get("content-type") ?? "application/octet-stream",
                        size: Number(response.headers.get("content-length") ?? 0)
                    }
                :   undefined;
        },
        head: async key => {
            const response = await access.client.fetch(access.addressOf(key), { method: "HEAD" });

            return response.ok ?
                    {
                        mimeType: response.headers.get("content-type") ?? "application/octet-stream",
                        size: Number(response.headers.get("content-length") ?? 0)
                    }
                :   undefined;
        },
        publicAddress,
        presignPut
    };
}

function isR2Bucket(value: unknown): value is R2Bucket {
    return (
        typeof value === "object"
        && value !== null
        && typeof (value as R2Bucket).put === "function"
        && typeof (value as R2Bucket).head === "function"
        && typeof (value as R2Bucket).delete === "function"
    );
}

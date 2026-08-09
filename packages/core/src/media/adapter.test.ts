import { describe, expect, it, vi } from "vitest";
import { createStorageAdapter, type BucketRecord } from "./adapter";

const credentials = {
    accountId: "0123456789abcdef0123456789abcdef",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key"
};

function bucketRow(partial: Partial<BucketRecord> = {}): BucketRecord {
    return {
        id: "media",
        kind: "binding",
        binding: "MEDIA_BUCKET",
        endpoint: null,
        region: null,
        bucketName: "jamcaa-docs-media",
        accessKeyId: null,
        secretAccessKey: null,
        publicUrl: null,
        ...partial
    };
}

function fakeBucket() {
    return { put: vi.fn(async () => undefined), head: vi.fn(async () => null), delete: vi.fn(async () => undefined) };
}

describe("a bucket reached through a binding", () => {
    it("writes through the binding rather than over the network", async () => {
        const target = fakeBucket();
        const adapter = createStorageAdapter({ record: bucketRow(), bindings: { MEDIA_BUCKET: target } });

        await adapter.put("2026/08/cat.png", new ArrayBuffer(4), "image/png");

        expect(target.put).toHaveBeenCalledWith("2026/08/cat.png", expect.anything(), {
            httpMetadata: { contentType: "image/png" }
        });
    });

    it("says which binding it wanted when the Worker has none", () => {
        expect(() => createStorageAdapter({ record: bucketRow(), bindings: {} })).toThrow(
            /binding named "MEDIA_BUCKET"/
        );
    });

    it("cannot hand out an address to write to without credentials to sign with", () => {
        const adapter = createStorageAdapter({ record: bucketRow(), bindings: { MEDIA_BUCKET: fakeBucket() } });

        expect(adapter.presignPut).toBeUndefined();
    });

    it("hands out a signed address once credentials are configured", async () => {
        const adapter = createStorageAdapter({
            record: bucketRow(),
            bindings: { MEDIA_BUCKET: fakeBucket() },
            credentials
        });

        const address = await adapter.presignPut!("2026/08/cat.png", "image/png", 900);
        const url = new URL(address);

        expect(url.host).toBe(`${credentials.accountId}.r2.cloudflarestorage.com`);
        expect(url.pathname).toBe("/jamcaa-docs-media/2026/08/cat.png");
        expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
        expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
        // The secret must never travel in the address it signs.
        expect(address).not.toContain(credentials.secretAccessKey);
    });
});

describe("where readers fetch an object from", () => {
    it("has no public address until the bucket is given one", () => {
        const adapter = createStorageAdapter({ record: bucketRow(), bindings: { MEDIA_BUCKET: fakeBucket() } });

        expect(adapter.publicAddress("cat.png")).toBeUndefined();
    });

    it("joins the configured address without doubling the slash", () => {
        const adapter = createStorageAdapter({
            record: bucketRow({ publicUrl: "https://media.example.com/" }),
            bindings: { MEDIA_BUCKET: fakeBucket() }
        });

        expect(adapter.publicAddress("2026/cat.png")).toBe("https://media.example.com/2026/cat.png");
    });
});

describe("a bucket reached by signing", () => {
    const external = bucketRow({
        id: "external",
        kind: "s3",
        binding: null,
        endpoint: "https://s3.example.com",
        region: "eu-west-1",
        bucketName: "elsewhere",
        accessKeyId: "their-key",
        secretAccessKey: "their-secret"
    });

    it("needs no binding at all", () => {
        expect(() => createStorageAdapter({ record: external })).not.toThrow();
    });

    it("says what is missing when it cannot be reached", () => {
        expect(() => createStorageAdapter({ record: bucketRow({ kind: "s3", endpoint: null }) })).toThrow(
            /endpoint or credentials/
        );
    });

    it("signs against its own endpoint and region", async () => {
        const adapter = createStorageAdapter({ record: external });
        const url = new URL(await adapter.presignPut!("cat.png", "image/png", 60));

        expect(url.host).toBe("s3.example.com");
        expect(url.pathname).toBe("/elsewhere/cat.png");
        expect(url.searchParams.get("X-Amz-Credential")).toContain("eu-west-1");
    });
});

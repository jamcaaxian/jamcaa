import {
    completeMultipartUpload,
    MultipartUploadNotEstablishedError,
    planMultipartUpload,
    recordMultipartPart,
    type UploadedPart
} from "@jamcaa/core/media";
import { coreSettings, loadSettings } from "@jamcaa/core/settings";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const PART_SIZE = 5 * 1024 * 1024;
const PART_URL_EXPIRES_IN_SECONDS = 5 * 60;
const CONTENT_FINGERPRINT = /^sha256-tree-v1:[0-9a-f]{64}$/;

function problem(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

async function actorWhoMayUpload() {
    const session = await getSession();

    if (session === null) {
        return { problem: problem(401, "Sign in to upload.") } as const;
    }

    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "media", "upload"))) {
        return { problem: problem(403, "You do not have permission to upload.") } as const;
    }

    return { actor } as const;
}

function preparation(value: unknown) {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const type = typeof candidate.type === "string" && candidate.type ? candidate.type : "application/octet-stream";
    const fingerprint = typeof candidate.fingerprint === "string" ? candidate.fingerprint.trim() : "";
    const collection = typeof candidate.collection === "string" ? candidate.collection.trim() : "";
    const size = candidate.size;

    return (
            name
                && CONTENT_FINGERPRINT.test(fingerprint)
                && typeof size === "number"
                && Number.isSafeInteger(size)
                && size >= PART_SIZE
        ) ?
            { name, type, size, fingerprint, ...(collection ? { collection } : {}) }
        :   undefined;
}

function uploadedPart(value: unknown): { id: string; part: UploadedPart } | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const candidate = value as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const partNumber = candidate.partNumber;
    const etag = typeof candidate.etag === "string" ? candidate.etag : "";

    return id && typeof partNumber === "number" && Number.isSafeInteger(partNumber) && partNumber > 0 && etag ?
            { id, part: { partNumber, etag } }
        :   undefined;
}

export async function POST(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const file = preparation((await request.json().catch(() => undefined)) as unknown);

    if (file === undefined) {
        return problem(400, "Describe the large file before requesting multipart upload addresses.");
    }

    const { database, bindings, credentials } = mediaRuntime();
    const settings = await loadSettings(database, coreSettings);
    const maxMegabytes = settings.get("media.maxUploadMegabytes");

    if (file.size > maxMegabytes * 1024 * 1024) {
        return problem(413, `That file is larger than the ${maxMegabytes} MB limit.`);
    }

    try {
        const plan = await planMultipartUpload({
            database,
            bindings,
            credentials,
            file,
            context: {
                collection: file.collection,
                authorRole: access.actor.role,
                authorId: access.actor.id,
                mimeType: file.type,
                size: file.size,
                at: new Date()
            },
            uploaderId: access.actor.id,
            fingerprint: file.fingerprint,
            partSize: PART_SIZE,
            expiresInSeconds: PART_URL_EXPIRES_IN_SECONDS
        });

        return Response.json(plan);
    } catch (error) {
        if (error instanceof MultipartUploadNotEstablishedError) {
            return Response.json({ fallback: "server" });
        }

        return problem(409, error instanceof Error ? error.message : "That multipart upload could not be prepared.");
    }
}

export async function PATCH(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const input = uploadedPart((await request.json().catch(() => undefined)) as unknown);

    if (input === undefined) {
        return problem(400, "Name the completed multipart upload part.");
    }

    try {
        await recordMultipartPart({
            database: mediaRuntime().database,
            id: input.id,
            uploaderId: access.actor.id,
            part: input.part
        });
        return new Response(null, { status: 204 });
    } catch (error) {
        return problem(409, error instanceof Error ? error.message : "That multipart part could not be recorded.");
    }
}

export async function PUT(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const input = (await request.json().catch(() => undefined)) as { id?: unknown } | undefined;
    const id = typeof input?.id === "string" ? input.id : "";

    if (!id) {
        return problem(400, "Name the multipart upload to complete.");
    }

    const { database, bindings, credentials } = mediaRuntime();

    try {
        const stored = await completeMultipartUpload({
            database,
            bindings,
            credentials,
            id,
            uploaderId: access.actor.id
        });

        return Response.json({
            id: stored.id,
            filename: stored.filename,
            mimeType: stored.mimeType,
            size: stored.size,
            alt: stored.alt,
            address: `/media/${stored.id}`
        });
    } catch (error) {
        return problem(409, error instanceof Error ? error.message : "That multipart upload could not be completed.");
    }
}

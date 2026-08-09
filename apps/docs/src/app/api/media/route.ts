import { acceptUpload, cancelUpload, confirmUpload } from "@jamcaa/core/media";
import { coreSettings, loadSettings } from "@jamcaa/core/settings";
import { mediaRuntime } from "@/lib/media";
import { transferModeFor } from "@/lib/media-transfer";
import { may } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

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

function uploadContext(
    actor: { id: string; role?: string | null },
    file: { type: string; size: number },
    collection?: string
) {
    return {
        collection,
        authorRole: actor.role,
        authorId: actor.id,
        mimeType: file.type,
        size: file.size,
        at: new Date()
    };
}

function fileDescription(value: unknown) {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const type = typeof candidate.type === "string" && candidate.type ? candidate.type : "application/octet-stream";
    const size = candidate.size;

    return name && typeof size === "number" && Number.isSafeInteger(size) && size >= 0 ?
            { name, type, size }
        :   undefined;
}

export async function PUT(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const input = (await request.json().catch(() => undefined)) as unknown;
    const file = fileDescription(input);

    if (file === undefined) {
        return problem(400, "Describe the file before requesting a direct upload.");
    }

    const { database } = mediaRuntime();
    const settings = await loadSettings(database, coreSettings);
    const maxMegabytes = settings.get("media.maxUploadMegabytes");
    const limit = maxMegabytes * 1024 * 1024;

    if (file.size > limit) {
        return problem(413, `That file is larger than the ${maxMegabytes} MB limit.`);
    }

    if (transferModeFor(file.size) === "server") {
        return Response.json({ mode: "server" });
    }

    return Response.json({ mode: "multipart" });
}

export async function PATCH(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const input = (await request.json().catch(() => undefined)) as { id?: unknown } | undefined;
    const id = typeof input?.id === "string" ? input.id : "";

    if (!id) {
        return problem(400, "Name the pending upload to confirm.");
    }

    const { database, bindings, credentials } = mediaRuntime();

    try {
        const stored = await confirmUpload({ database, bindings, credentials, id, uploaderId: access.actor.id });

        return Response.json({ id: stored.id, filename: stored.filename, address: `/media/${stored.id}` });
    } catch (error) {
        return problem(409, error instanceof Error ? error.message : "That direct upload could not be confirmed.");
    }
}

export async function DELETE(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const input = (await request.json().catch(() => undefined)) as { id?: unknown } | undefined;
    const id = typeof input?.id === "string" ? input.id : "";

    if (!id) {
        return problem(400, "Name the pending upload to cancel.");
    }

    const { database, bindings, credentials } = mediaRuntime();

    try {
        await cancelUpload({ database, bindings, credentials, id, uploaderId: access.actor.id });
        return new Response(null, { status: 204 });
    } catch (error) {
        return problem(409, error instanceof Error ? error.message : "That direct upload could not be cancelled.");
    }
}

export async function POST(request: Request) {
    const access = await actorWhoMayUpload();

    if ("problem" in access) {
        return access.problem;
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
        return problem(400, "Attach a file to upload.");
    }

    const { database, bindings, credentials } = mediaRuntime();
    const settings = await loadSettings(database, coreSettings);
    const limit = settings.get("media.maxUploadMegabytes") * 1024 * 1024;

    if (file.size > limit) {
        return problem(413, `That file is larger than the ${settings.get("media.maxUploadMegabytes")} MB limit.`);
    }

    try {
        const stored = await acceptUpload({
            database,
            bindings,
            credentials,
            file: {
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                body: await file.arrayBuffer()
            },
            // Whatever the caller knows, so a rule may be written about it.
            context: {
                ...uploadContext(
                    access.actor,
                    { type: file.type || "application/octet-stream", size: file.size },
                    form.get("collection")?.toString()
                )
            },
            uploaderId: access.actor.id
        });

        return Response.json({ id: stored.id, filename: stored.filename, address: `/media/${stored.id}` });
    } catch (error) {
        return problem(500, error instanceof Error ? error.message : "That file could not be stored.");
    }
}

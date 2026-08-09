import { acceptUpload } from "@jamcaa/core/media";
import { coreSettings, loadSettings } from "@jamcaa/core/settings";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function problem(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
    const session = await getSession();

    if (session === null) {
        return problem(401, "Sign in to upload.");
    }

    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "media", "upload"))) {
        return problem(403, "You do not have permission to upload.");
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
                collection: form.get("collection")?.toString(),
                authorRole: actor.role,
                authorId: actor.id,
                mimeType: file.type || "application/octet-stream",
                size: file.size,
                at: new Date()
            },
            uploaderId: actor.id
        });

        return Response.json({ id: stored.id, filename: stored.filename, address: `/media/${stored.id}` });
    } catch (error) {
        return problem(500, error instanceof Error ? error.message : "That file could not be stored.");
    }
}

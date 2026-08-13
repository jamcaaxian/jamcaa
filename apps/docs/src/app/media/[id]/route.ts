import { redirect } from "next/navigation";
import { openMedia } from "@jamcaaxian/core/media";
import { mediaRuntime } from "@/lib/media";

export const dynamic = "force-dynamic";

/**
 * Served by identifier rather than by object key: the key is the bucket's business,
 * and a path taken from the address bar has no business reaching it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { database, bindings, credentials } = mediaRuntime();
    const found = await openMedia({ database, bindings, credentials, id: (await params).id });

    if (found === undefined || found.record.state !== "stored") {
        return new Response("Not found", { status: 404 });
    }

    const direct = found.adapter.publicAddress(found.record.objectKey);

    if (direct !== undefined) {
        redirect(direct);
    }

    const object = await found.adapter.get(found.record.objectKey);

    if (object === undefined) {
        return new Response("Not found", { status: 404 });
    }

    return new Response(object.body, {
        headers: {
            "content-type": object.mimeType,
            // The identifier names this exact file, so it can never mean another one.
            "cache-control": "public, max-age=31536000, immutable"
        }
    });
}

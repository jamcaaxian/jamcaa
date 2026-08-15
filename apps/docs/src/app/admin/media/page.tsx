import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { listMedia } from "@jamcaaxian/core/media";
import { coreSettings, loadSettings } from "@jamcaaxian/core/settings";
import { adminMessages } from "@/content/admin-locale";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { DeleteMediaButton } from "./delete-media-button";
import { MediaUploader } from "./media-uploader";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.media.title };
}

function readableSize(bytes: number) {
    return bytes < 1024 * 1024 ?
            `${Math.max(1, Math.round(bytes / 1024))} KB`
        :   `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaPage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "media", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.media.permission}</p>;
    }

    const { database } = mediaRuntime();
    const [files, settings, mayUpload, mayDeleteAny, mayDeleteOwn] = await Promise.all([
        listMedia(database),
        loadSettings(database, coreSettings),
        may(actor, "media", "upload"),
        may(actor, "media", "delete-any"),
        may(actor, "media", "delete-own")
    ]);

    // The same rule mayTouch applies, settled once rather than per file.
    const mayDelete = (uploaderId: string) => mayDeleteAny || (mayDeleteOwn && uploaderId === actor.id);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">{copy.media.title}</h1>
                <p className="text-muted-foreground text-sm">{copy.media.count(files.length)}</p>
            </div>

            {mayUpload ?
                <MediaUploader maxMegabytes={settings.get("media.maxUploadMegabytes")} />
            :   null}

            {files.length === 0 ?
                <p className="text-muted-foreground text-sm">{copy.media.empty}</p>
            :   <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {files.map(file => (
                        <li key={file.id} className="space-y-2">
                            <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
                                {file.mimeType.startsWith("image/") ?
                                    // eslint-disable-next-line @next/next/no-img-element -- streamed from our own route
                                    <img
                                        src={`/media/${file.id}`}
                                        alt={file.alt ?? ""}
                                        className="size-full object-cover"
                                    />
                                :   <FileText className="text-muted-foreground size-8" />}
                            </div>
                            <div className="space-y-1">
                                <div className="truncate text-sm font-medium" title={file.filename}>
                                    {file.filename}
                                </div>
                                <div className="text-muted-foreground flex items-center justify-between text-xs">
                                    <span>{readableSize(file.size)}</span>
                                    {mayDelete(file.uploaderId) ?
                                        <DeleteMediaButton id={file.id} filename={file.filename} />
                                    :   null}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            }
        </div>
    );
}

import { renderRichTextToHtml, type RichTextDocument } from "@jamcaa/core/content";
import { cn } from "@/lib/utils";

export function RichTextContent({ document, className }: { document: RichTextDocument; className?: string }) {
    return (
        <div
            className={cn("rich-text-content", className)}
            dangerouslySetInnerHTML={{
                __html: renderRichTextToHtml(document, {
                    mediaAddress: mediaId => `/media/${encodeURIComponent(mediaId)}`
                })
            }}
        />
    );
}

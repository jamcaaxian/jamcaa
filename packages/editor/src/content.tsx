import { renderRichTextToHtml, type RichTextDocument } from "@jamcaa/core/content";

export interface RichTextContentProps {
    document: RichTextDocument;
    mediaAddress(mediaId: string): string | undefined;
    className?: string;
}

export function RichTextContent({ document, mediaAddress, className }: RichTextContentProps) {
    const classes = ["jamcaa-rich-text-content", className].filter(Boolean).join(" ");

    return (
        <div
            className={classes}
            dangerouslySetInnerHTML={{ __html: renderRichTextToHtml(document, { mediaAddress }) }}
        />
    );
}

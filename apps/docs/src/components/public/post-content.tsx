import Link from "next/link";
import { RichTextContent } from "@jamcaa/editor/content";
import type { RichTextDocument } from "@jamcaa/core/content";

export interface PublicPost {
    title: string;
    excerpt: string | null;
    body: RichTextDocument;
    publishedAt: Date | null;
    createdAt: Date;
}

export function PostContent({
    post,
    publishedLabel,
    statusLabel = "Published",
    statusMoment,
    backAddress = "/",
    backLabel = "All Posts"
}: {
    post: PublicPost;
    publishedLabel: string;
    statusLabel?: string;
    statusMoment?: Date;
    backAddress?: string;
    backLabel?: string;
}) {
    const displayedAt = statusMoment ?? post.publishedAt ?? post.createdAt;

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-14 sm:px-6 sm:py-24">
            <Link href={backAddress} className="text-muted-foreground hover:text-foreground text-sm">
                ← {backLabel}
            </Link>
            <article className="mt-10">
                <header className="mb-10 space-y-4">
                    <h1 className="text-3xl font-semibold tracking-tight wrap-anywhere sm:text-5xl">{post.title}</h1>
                    {post.excerpt ?
                        <p className="text-muted-foreground text-lg leading-8">{post.excerpt}</p>
                    :   null}
                    <p className="text-muted-foreground text-sm">
                        {statusLabel} <time dateTime={displayedAt.toISOString()}>{publishedLabel}</time>
                    </p>
                </header>
                <RichTextContent
                    document={post.body}
                    mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
                />
            </article>
        </main>
    );
}

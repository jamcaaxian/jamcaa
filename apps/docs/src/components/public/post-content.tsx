import Link from "next/link";
import { BuiltinBlockView } from "@jamcaaxian/editor/blocks";
import type { BlockDocument } from "@jamcaaxian/core/content";

export interface PublicPost {
    title: string;
    excerpt: string | null;
    body: BlockDocument;
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
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
            <Link
                href={backAddress}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors duration-200 ease-spring"
            >
                <span aria-hidden="true">‹</span> {backLabel}
            </Link>
            <article className="mt-10">
                <header className="border-border/70 mb-12 border-b pb-10">
                    <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                        {post.title}
                    </h1>
                    {post.excerpt ?
                        <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">{post.excerpt}</p>
                    :   null}
                    <p className="text-muted-foreground mt-6 flex items-baseline gap-2 font-mono text-xs tabular-nums">
                        <span className="bg-muted rounded-full px-2.5 py-0.5 font-sans text-[11px] font-medium tracking-wide uppercase">
                            {statusLabel}
                        </span>
                        <time dateTime={displayedAt.toISOString()}>{publishedLabel}</time>
                    </p>
                </header>
                <div>
                    {post.body.blocks.map(block => (
                        <BuiltinBlockView
                            key={block.id}
                            block={block}
                            mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
                        />
                    ))}
                </div>
            </article>
        </main>
    );
}

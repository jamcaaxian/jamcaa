import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { BlockDocumentView } from "@jamcaaxian/editor/blocks";
import type { BlockDocument } from "@jamcaaxian/core/content";
import { documentOutline, headingIdFactory } from "@/content/document-outline";
import { docsSidebarNavigation } from "@/content/docs-navigation";
import type { DocsLocale } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";

export interface DocsArticlePost {
    title: string;
    excerpt: string | null;
    body: BlockDocument;
    updatedAt: Date;
}

export interface DocsArticleNavigation {
    title: string;
    address: string;
}

export function DocsArticle({
    post,
    locale,
    updatedLabel,
    previous,
    next
}: {
    post: DocsArticlePost;
    locale: DocsLocale;
    updatedLabel: string;
    previous?: DocsArticleNavigation;
    next?: DocsArticleNavigation;
}) {
    const messages = publicCopy(locale);
    const outline = documentOutline(post.body).filter(heading => heading.level >= 2 && heading.level <= 3);
    const idForHeading = headingIdFactory();
    const sidebar = docsSidebarNavigation(locale);

    return (
        <main id="main-content" className="mx-auto w-full max-w-384 px-4 sm:px-6 lg:px-8">
            <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 xl:grid-cols-[14rem_minmax(0,52rem)_14rem] xl:gap-10">
                <aside className="border-border/70 hidden border-r py-10 pr-6 xl:block">
                    <nav aria-label={messages.docs} className="sticky top-24 space-y-8 text-sm">
                        {sidebar.map(section => (
                            <div key={section.label} className="space-y-2">
                                <p className="text-foreground font-semibold">{section.label}</p>
                                {section.items.map(item => (
                                    <Link
                                        key={item.href}
                                        className="text-muted-foreground hover:text-foreground block py-1"
                                        href={item.href}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </nav>
                </aside>

                <article className="min-w-0 py-10 sm:py-16 xl:py-20">
                    <header className="border-border/70 border-b pb-10">
                        <p className="text-primary mb-4 text-sm font-semibold tracking-wide">Jamcaa Docs</p>
                        <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
                            {post.title}
                        </h1>
                        {post.excerpt ?
                            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8 text-pretty">
                                {post.excerpt}
                            </p>
                        :   null}
                        <p className="text-muted-foreground mt-6 text-xs">
                            {messages.updated} <time dateTime={post.updatedAt.toISOString()}>{updatedLabel}</time>
                        </p>
                    </header>

                    <BlockDocumentView
                        document={post.body}
                        headingId={idForHeading}
                        mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
                        className="docs-article-content mt-10"
                    />

                    <nav
                        aria-label={`${messages.previous} / ${messages.next}`}
                        className="mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2"
                    >
                        {previous ?
                            <Link
                                href={previous.address}
                                className="group rounded-2xl border p-5 transition-[background-color,transform] duration-150 hover:bg-accent/60 active:scale-[0.99]"
                            >
                                <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                                    <ArrowLeft className="size-3.5" />
                                    {messages.previous}
                                </span>
                                <strong className="mt-2 block text-base font-semibold">{previous.title}</strong>
                            </Link>
                        :   <span />}
                        {next ?
                            <Link
                                href={next.address}
                                className="group rounded-2xl border p-5 text-right transition-[background-color,transform] duration-150 hover:bg-accent/60 active:scale-[0.99]"
                            >
                                <span className="text-muted-foreground flex items-center justify-end gap-2 text-xs font-medium uppercase tracking-wide">
                                    {messages.next}
                                    <ArrowRight className="size-3.5" />
                                </span>
                                <strong className="mt-2 block text-base font-semibold">{next.title}</strong>
                            </Link>
                        :   null}
                    </nav>
                </article>

                <aside className="hidden py-20 xl:block">
                    <div className="sticky top-24 space-y-8">
                        {outline.length > 0 && (
                            <nav aria-label={messages.onThisPage}>
                                <p className="mb-3 text-xs font-semibold tracking-wide uppercase">
                                    {messages.onThisPage}
                                </p>
                                <ol className="border-border space-y-2 border-l pl-4 text-sm">
                                    {outline.map(heading => (
                                        <li key={heading.id} className={heading.level === 3 ? "pl-3" : undefined}>
                                            <a
                                                className="text-muted-foreground hover:text-foreground block leading-5"
                                                href={`#${heading.id}`}
                                            >
                                                {heading.text}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                        )}
                        <Link
                            href="/admin/posts"
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
                        >
                            {messages.editPage}
                            <ExternalLink className="size-3.5" />
                        </Link>
                    </div>
                </aside>
            </div>
        </main>
    );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { RichTextContent } from "@/components/rich-text-content";
import { posts } from "@/content/store";

export const dynamic = "force-dynamic";

async function publishedPost(slug: string) {
    const { env } = getCloudflareContext();
    const entry = await posts(createDatabase(env.DB)).bySlug(slug);

    return entry?.status === "published" ? entry : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const entry = await publishedPost((await params).slug);

    return entry ? { title: entry.title, description: entry.excerpt ?? undefined } : { title: "Post not found" };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
    const entry = await publishedPost((await params).slug);

    if (entry === undefined) notFound();

    return (
        <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 sm:py-24">
            <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
                ← All Posts
            </Link>
            <article className="mt-10">
                <header className="mb-10 space-y-4">
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{entry.title}</h1>
                    {entry.excerpt ?
                        <p className="text-muted-foreground text-lg leading-8">{entry.excerpt}</p>
                    :   null}
                </header>
                <RichTextContent document={entry.body} />
            </article>
        </main>
    );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostContent } from "@/components/public/post-content";
import { publicMoment, publishedPostAt } from "@/content/public-site";

export const dynamic = "force-dynamic";

async function requestedPost(params: Promise<{ path: string[] }>) {
    return publishedPostAt((await params).path);
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
    const entry = await requestedPost(params);

    return entry ?
            {
                title: entry.title,
                description: entry.excerpt ?? undefined,
                openGraph: {
                    title: entry.title,
                    description: entry.excerpt ?? undefined,
                    type: "article",
                    publishedTime: (entry.publishedAt ?? entry.createdAt).toISOString()
                }
            }
        :   { title: "Post not found" };
}

export default async function PublicEntryPage({ params }: { params: Promise<{ path: string[] }> }) {
    const entry = await requestedPost(params);

    if (entry === undefined) notFound();

    const published = await publicMoment(entry.publishedAt ?? entry.createdAt);

    return <PostContent post={entry} publishedLabel={published.label} />;
}

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { counterServicePort } from "@jamcaa/core/counters";
import { PostContent } from "@/components/public/post-content";
import { publicMoment, publishedPostAt } from "@/content/public-site";

export const dynamic = "force-dynamic";

async function requestedPost(params: Promise<{ path: string[] }>) {
    return publishedPostAt((await params).path);
}

function countView(entryId: string): void {
    try {
        const { env, ctx } = getCloudflareContext();

        if (env.COUNTERS === undefined) {
            return;
        }

        ctx.waitUntil(counterServicePort(env.COUNTERS).increment({ collectionName: "post", entryId }, "view"));
    } catch {
        // No Cloudflare context, for example in tests outside the Worker: skip counting.
    }
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
    const entry = await requestedPost(params);

    return entry?.kind === "entry" ?
            {
                title: entry.entry.title,
                description: entry.entry.excerpt ?? undefined,
                openGraph: {
                    title: entry.entry.title,
                    description: entry.entry.excerpt ?? undefined,
                    type: "article",
                    publishedTime: (entry.entry.publishedAt ?? entry.entry.createdAt).toISOString()
                }
            }
        :   { title: "Post not found" };
}

export default async function PublicEntryPage({ params }: { params: Promise<{ path: string[] }> }) {
    const entry = await requestedPost(params);

    if (entry === undefined) notFound();

    if (entry.kind === "former") {
        permanentRedirect(entry.address);
    }

    countView(entry.entry.id);

    const published = await publicMoment(entry.entry.publishedAt ?? entry.entry.createdAt);

    return <PostContent post={entry.entry} publishedLabel={published.label} />;
}

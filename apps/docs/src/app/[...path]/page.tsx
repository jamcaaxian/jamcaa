import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { counterServicePort } from "@jamcaaxian/core/counters";
import { PageContent } from "@/components/public/page-content";
import { PostContent } from "@/components/public/post-content";
import { publicMoment, publicPageAt, publishedPostAt } from "@/content/public-site";

export const dynamic = "force-dynamic";

function countView(entryId: string): void {
    try {
        const { env, ctx } = getCloudflareContext();

        if (env.COUNTERS === undefined) {
            return;
        }

        // View counting is best-effort telemetry: a missing or failing
        // counters Worker (for example in local development) must never
        // take a public page down.
        ctx.waitUntil(
            counterServicePort(env.COUNTERS)
                .increment({ collectionName: "post", entryId }, "view")
                .catch(() => undefined)
        );
    } catch {
        // No Cloudflare context, for example in tests outside the Worker: skip counting.
    }
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
    const entry = await publishedPostAt((await params).path);

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
    const [entry, page] = await Promise.all([publishedPostAt((await params).path), publicPageAt((await params).path)]);

    if (page !== undefined) {
        return <PageContent title={page.title} body={page.body} />;
    }

    if (entry === undefined) notFound();

    if (entry.kind === "former") {
        permanentRedirect(entry.address);
    }

    countView(entry.entry.id);

    const published = await publicMoment(entry.entry.publishedAt ?? entry.entry.createdAt);

    return <PostContent post={entry.entry} publishedLabel={published.label} />;
}

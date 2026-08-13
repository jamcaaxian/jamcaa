import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { formatMoment } from "@jamcaaxian/core/dates";
import { getSettings } from "@jamcaaxian/core/settings";
import { RichTextContent } from "@jamcaaxian/editor/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteSettings } from "@/content/settings";
import { postRevisions, posts } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { RestoreRevisionButton } from "../restore-revision-button";

export const metadata: Metadata = { title: "Post Revision" };

const tone = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function PostRevisionPage({ params }: { params: Promise<{ id: string; revisionId: string }> }) {
    const { id, revisionId } = await params;
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const entry = await posts(database).byId(id);

    if (entry === undefined || !(await mayTouch(actor, "post", "update", entry.authorId))) {
        notFound();
    }

    const revision = await postRevisions(database).byId(entry.id, revisionId);

    if (revision === undefined) {
        notFound();
    }

    const terms = taxonomy(database);
    const [settings, category, tags] = await Promise.all([
        getSettings(database, siteSettings),
        terms.categoryById(revision.snapshot.categoryId),
        Promise.all(revision.snapshot.tagIds.map(tagId => terms.tagById(tagId)))
    ]);
    const datePattern = settings.get("format.date");
    const timePattern = settings.get("format.time");
    const savedLabel = `${formatMoment(revision.createdAt, datePattern)} ${formatMoment(revision.createdAt, timePattern)}`;
    const publishedAt = revision.snapshot.publishedAt === null ? null : new Date(revision.snapshot.publishedAt);

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight wrap-anywhere">
                        {revision.snapshot.fields.title}
                    </h1>
                    <p className="text-muted-foreground text-sm">Revision saved {savedLabel}</p>
                </div>
                <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/admin/posts/${entry.id}/revisions`} />}
                >
                    All Revisions
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Saved state</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant={tone[revision.snapshot.status]} className="mt-1">
                            {revision.snapshot.status}
                        </Badge>
                    </div>
                    <div className="min-w-0">
                        <p className="text-muted-foreground">Slug</p>
                        <p className="mt-1 wrap-anywhere">{revision.snapshot.slug}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="mt-1 wrap-anywhere">
                            {category?.name ?? `Deleted category (${revision.snapshot.categoryId})`}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Published</p>
                        <p className="mt-1">
                            {publishedAt === null ?
                                "Not published"
                            :   `${formatMoment(publishedAt, datePattern)} ${formatMoment(publishedAt, timePattern)}`}
                        </p>
                    </div>
                    <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Tags</p>
                        <p className="mt-1 wrap-anywhere">
                            {revision.snapshot.tagIds.length === 0 ?
                                "No tags"
                            :   tags
                                    .map(
                                        (tag, index) => tag?.name ?? `Deleted tag (${revision.snapshot.tagIds[index]})`
                                    )
                                    .join(", ")
                            }
                        </p>
                    </div>
                </CardContent>
            </Card>

            <article className="max-w-3xl space-y-8">
                {revision.snapshot.fields.excerpt ?
                    <p className="text-muted-foreground text-lg leading-8">{revision.snapshot.fields.excerpt}</p>
                :   null}
                <RichTextContent
                    document={revision.snapshot.fields.body}
                    mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
                />
            </article>

            <div className="border-t pt-6">
                <RestoreRevisionButton entryId={entry.id} revisionId={revision.id} />
            </div>
        </div>
    );
}

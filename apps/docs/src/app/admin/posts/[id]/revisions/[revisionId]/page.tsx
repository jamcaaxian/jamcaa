import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { formatMoment } from "@jamcaaxian/core/dates";
import { getSettings } from "@jamcaaxian/core/settings";
import { blocksToRichText, type BlockDocument } from "@jamcaaxian/core/content";
import { RichTextContent } from "@jamcaaxian/editor/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminMessages } from "@/content/admin-locale";
import { siteSettings } from "@/content/settings";
import { postRevisions, posts } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { RestoreRevisionButton } from "../restore-revision-button";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.posts.revisions.savedState };
}

const tone = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function PostRevisionPage({ params }: { params: Promise<{ id: string; revisionId: string }> }) {
    const { locale, copy } = await adminMessages();
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
    const savedLabel = `${formatMoment(revision.createdAt, datePattern, locale)} ${formatMoment(revision.createdAt, timePattern, locale)}`;
    const publishedAt = revision.snapshot.publishedAt === null ? null : new Date(revision.snapshot.publishedAt);

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight wrap-anywhere">
                        {revision.snapshot.fields.title}
                    </h1>
                    <p className="text-muted-foreground text-sm">{copy.posts.revisions.detailSavedAt(savedLabel)}</p>
                </div>
                <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/admin/posts/${entry.id}/revisions`} />}
                >
                    {copy.posts.revisions.all}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{copy.posts.revisions.savedState}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                        <p className="text-muted-foreground">{copy.posts.revisions.status}</p>
                        <Badge variant={tone[revision.snapshot.status]} className="mt-1">
                            {copy.common.status[revision.snapshot.status]}
                        </Badge>
                    </div>
                    <div className="min-w-0">
                        <p className="text-muted-foreground">{copy.posts.revisions.slug}</p>
                        <p className="mt-1 wrap-anywhere">{revision.snapshot.slug}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{copy.posts.revisions.category}</p>
                        <p className="mt-1 wrap-anywhere">
                            {category?.name ?? copy.posts.revisions.deletedCategory(revision.snapshot.categoryId)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{copy.posts.revisions.published}</p>
                        <p className="mt-1">
                            {publishedAt === null ?
                                copy.posts.revisions.notPublished
                            :   `${formatMoment(publishedAt, datePattern, locale)} ${formatMoment(publishedAt, timePattern, locale)}`
                            }
                        </p>
                    </div>
                    <div className="sm:col-span-2">
                        <p className="text-muted-foreground">{copy.posts.revisions.tags}</p>
                        <p className="mt-1 wrap-anywhere">
                            {revision.snapshot.tagIds.length === 0 ?
                                copy.posts.revisions.noTags
                            :   tags
                                    .map(
                                        (tag, index) =>
                                            tag?.name
                                            ?? copy.posts.revisions.deletedTag(revision.snapshot.tagIds[index] ?? "")
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
                    document={blocksToRichText(revision.snapshot.fields.body as unknown as BlockDocument)}
                    mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
                />
            </article>

            <div className="border-t pt-6">
                <RestoreRevisionButton entryId={entry.id} revisionId={revision.id} />
            </div>
        </div>
    );
}

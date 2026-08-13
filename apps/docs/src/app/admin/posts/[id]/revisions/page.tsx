import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { formatMoment } from "@jamcaaxian/core/dates";
import { getSettings } from "@jamcaaxian/core/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { siteSettings } from "@/content/settings";
import { postRevisions, posts } from "@/content/store";
import { mayTouch } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Post Revisions" };

const tone = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function PostRevisionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const entry = await posts(database).byId(id);

    if (entry === undefined || !(await mayTouch(actor, "post", "update", entry.authorId))) {
        notFound();
    }

    const [revisions, settings] = await Promise.all([
        postRevisions(database).list(entry.id),
        getSettings(database, siteSettings)
    ]);
    const datePattern = settings.get("format.date");
    const timePattern = settings.get("format.time");

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight">Revisions</h1>
                    <p className="text-muted-foreground text-sm wrap-anywhere">
                        {entry.title} ·{" "}
                        {revisions.length === 1 ? "One saved state" : `${revisions.length} saved states`}
                    </p>
                </div>
                <Button variant="outline" nativeButton={false} render={<Link href={`/admin/posts/${entry.id}`} />}>
                    Back to Post
                </Button>
            </div>

            {revisions.length === 0 ?
                <p className="text-muted-foreground text-sm">No Revisions have been saved yet.</p>
            :   <>
                    <ul className="space-y-3 md:hidden">
                        {revisions.map(revision => (
                            <li key={revision.id}>
                                <Link
                                    href={`/admin/posts/${entry.id}/revisions/${revision.id}`}
                                    className="block rounded-xl border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="font-medium wrap-anywhere">
                                                {revision.snapshot.fields.title}
                                            </h2>
                                            <p className="text-muted-foreground mt-1 truncate text-xs">
                                                Slug: {revision.snapshot.slug}
                                            </p>
                                        </div>
                                        <Badge variant={tone[revision.snapshot.status]}>
                                            {revision.snapshot.status}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground mt-3 text-xs">
                                        Saved {formatMoment(revision.createdAt, datePattern)}{" "}
                                        {formatMoment(revision.createdAt, timePattern)}
                                    </p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Saved state</TableHead>
                                    <TableHead className="w-32">Status</TableHead>
                                    <TableHead className="w-44">Saved</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {revisions.map(revision => (
                                    <TableRow key={revision.id}>
                                        <TableCell>
                                            <Link
                                                href={`/admin/posts/${entry.id}/revisions/${revision.id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {revision.snapshot.fields.title}
                                            </Link>
                                            <div className="text-muted-foreground text-xs">
                                                Slug: {revision.snapshot.slug}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={tone[revision.snapshot.status]}>
                                                {revision.snapshot.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatMoment(revision.createdAt, datePattern)}{" "}
                                            {formatMoment(revision.createdAt, timePattern)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            }
        </div>
    );
}

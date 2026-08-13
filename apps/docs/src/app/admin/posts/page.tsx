import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { counterServicePort } from "@jamcaa/core/counters";
import { formatMoment } from "@jamcaa/core/dates";
import { getSettings } from "@jamcaa/core/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { posts } from "@/content/store";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Posts" };

const tone = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function PostsPage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "post", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to read posts.</p>;
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const [entries, settings] = await Promise.all([posts(database).list(), getSettings(database, siteSettings)]);

    let views: Map<string, number> | undefined;

    if (env.COUNTERS !== undefined) {
        try {
            views = new Map(
                (
                    await counterServicePort(env.COUNTERS).readMany(
                        entries.map(entry => ({
                            target: { collectionName: "post", entryId: entry.id },
                            kind: "view" as const
                        }))
                    )
                ).map(result => [result.target.entryId, result.count])
            );
        } catch {
            // The counters Worker is optional; a broken one must not take the list down.
            views = undefined;
        }
    }
    const datePattern = settings.get("format.date");
    const timePattern = settings.get("format.time");
    const mayCreate = await may(actor, "post", "create");

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">Posts</h1>
                    <p className="text-muted-foreground text-sm">
                        {entries.length === 1 ? "One post" : `${entries.length} posts`}
                    </p>
                </div>
                {mayCreate ?
                    <Button nativeButton={false} render={<Link href="/admin/posts/new" />}>
                        New post
                    </Button>
                :   null}
            </div>

            {entries.length === 0 ?
                <p className="text-muted-foreground text-sm">Nothing written yet.</p>
            :   <>
                    <ul className="space-y-3 md:hidden">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <Link
                                    href={`/admin/posts/${entry.id}`}
                                    className="block rounded-xl border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h2 className="font-medium wrap-anywhere">{entry.title}</h2>
                                            <p className="text-muted-foreground mt-1 truncate text-xs">/{entry.slug}</p>
                                        </div>
                                        <Badge variant={tone[entry.status]}>{entry.status}</Badge>
                                    </div>
                                    <p className="text-muted-foreground mt-3 text-xs">
                                        {views === undefined ? null : `${views.get(entry.id) ?? 0} views · `}
                                        Last edited {formatMoment(entry.updatedAt, datePattern)}{" "}
                                        {formatMoment(entry.updatedAt, timePattern)}
                                    </p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead className="w-32">Status</TableHead>
                                    {views === undefined ? null : <TableHead className="w-20">Views</TableHead>}
                                    <TableHead className="w-44">Last edited</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell>
                                            <Link
                                                href={`/admin/posts/${entry.id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {entry.title}
                                            </Link>
                                            <div className="text-muted-foreground text-xs">/{entry.slug}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={tone[entry.status]}>{entry.status}</Badge>
                                        </TableCell>
                                        {views === undefined ? null : (
                                            <TableCell className="text-muted-foreground text-sm">
                                                {views.get(entry.id) ?? 0}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatMoment(entry.updatedAt, datePattern)}{" "}
                                            {formatMoment(entry.updatedAt, timePattern)}
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

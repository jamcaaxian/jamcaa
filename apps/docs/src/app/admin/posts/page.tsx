import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { posts } from "@/content/store";
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
    const entries = await posts(createDatabase(env.DB)).list();
    const mayCreate = await may(actor, "post", "create");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
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
            :   <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead className="w-44">Last edited</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map(entry => (
                            <TableRow key={entry.id}>
                                <TableCell>
                                    <Link href={`/admin/posts/${entry.id}`} className="font-medium hover:underline">
                                        {entry.title}
                                    </Link>
                                    <div className="text-muted-foreground text-xs">/{entry.slug}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={tone[entry.status]}>{entry.status}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {entry.updatedAt.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric"
                                    })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            }
        </div>
    );
}

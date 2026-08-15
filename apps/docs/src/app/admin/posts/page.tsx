import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { counterServicePort } from "@jamcaaxian/core/counters";
import { formatMoment } from "@jamcaaxian/core/dates";
import { getSettings } from "@jamcaaxian/core/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminMessages } from "@/content/admin-locale";
import { docsLocales, localizedPath } from "@/content/locales";
import { postAddress } from "@/content/public-paths";
import { posts } from "@/content/store";
import { siteSettings } from "@/content/settings";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.posts.list.title };
}

const tone = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function PostsPage() {
    const { locale, copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "post", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.posts.list.permission}</p>;
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
    const permalink = settings.get("permalink.post");
    const mayCreate = await may(actor, "post", "create");

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight">{copy.posts.list.title}</h1>
                    <p className="text-muted-foreground text-sm">{copy.posts.list.count(entries.length)}</p>
                </div>
                {mayCreate ?
                    <Button nativeButton={false} render={<Link href="/admin/posts/new" />}>
                        {copy.posts.list.new}
                    </Button>
                :   null}
            </div>

            {entries.length === 0 ?
                <div className="rounded-2xl border border-dashed px-8 py-16 text-center">
                    <p className="font-medium">{copy.posts.list.emptyTitle}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {mayCreate ? copy.posts.list.emptyCreate : copy.posts.list.emptyWait}
                    </p>
                </div>
            :   <>
                    <ul className="space-y-3 md:hidden">
                        {entries.map(entry => {
                            const entryLocale = docsLocales.canonical(entry.locale);
                            const address = postAddress(permalink, entry);
                            const publicAddress =
                                entryLocale === undefined ? address : localizedPath(entryLocale, address);

                            return (
                                <li key={entry.id}>
                                    <Link
                                        href={`/admin/posts/${entry.id}`}
                                        className="block rounded-xl border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                                    >
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="font-medium wrap-anywhere">{entry.title}</h2>
                                                <p className="text-muted-foreground mt-1 truncate text-xs">
                                                    {publicAddress}
                                                </p>
                                            </div>
                                            <Badge variant={tone[entry.status]}>
                                                {copy.common.status[entry.status]}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mt-3 text-xs">
                                            {views === undefined ? null : (
                                                `${copy.posts.list.views(views.get(entry.id) ?? 0)} · `
                                            )}
                                            {copy.posts.list.lastEdited(
                                                `${formatMoment(entry.updatedAt, datePattern, locale)} ${formatMoment(entry.updatedAt, timePattern, locale)}`
                                            )}
                                        </p>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{copy.posts.list.titleColumn}</TableHead>
                                    <TableHead className="w-32">{copy.posts.list.statusColumn}</TableHead>
                                    {views === undefined ? null : (
                                        <TableHead className="w-20">{copy.posts.list.viewsColumn}</TableHead>
                                    )}
                                    <TableHead className="w-44">{copy.posts.list.lastEditedColumn}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map(entry => {
                                    const entryLocale = docsLocales.canonical(entry.locale);
                                    const address = postAddress(permalink, entry);
                                    const publicAddress =
                                        entryLocale === undefined ? address : localizedPath(entryLocale, address);

                                    return (
                                        <TableRow key={entry.id}>
                                            <TableCell>
                                                <Link
                                                    href={`/admin/posts/${entry.id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {entry.title}
                                                </Link>
                                                <div className="text-muted-foreground text-xs">{publicAddress}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={tone[entry.status]}>
                                                    {copy.common.status[entry.status]}
                                                </Badge>
                                            </TableCell>
                                            {views === undefined ? null : (
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {views.get(entry.id) ?? 0}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatMoment(entry.updatedAt, datePattern, locale)}{" "}
                                                {formatMoment(entry.updatedAt, timePattern, locale)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </>
            }
        </div>
    );
}

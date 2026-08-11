import Link from "next/link";
import type { EntryOf } from "@jamcaa/core/content";
import { formatMoment } from "@jamcaa/core/dates";
import { post } from "@/content/collections";
import { postAddress } from "@/content/public-paths";

export function PostList({
    entries,
    permalink,
    datePattern,
    timePattern,
    emptyMessage
}: {
    entries: EntryOf<typeof post>[];
    permalink: string;
    datePattern: string;
    timePattern: string;
    emptyMessage: string;
}) {
    if (entries.length === 0) {
        return <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-sm">{emptyMessage}</div>;
    }

    return (
        <ul className="divide-y">
            {entries.map(entry => {
                const publishedAt = entry.publishedAt ?? entry.createdAt;
                const published = `${formatMoment(publishedAt, datePattern)} ${formatMoment(publishedAt, timePattern)}`;

                return (
                    <li key={entry.id} className="py-7 first:pt-0">
                        <Link href={postAddress(permalink, entry)} className="group block space-y-2">
                            <h2 className="group-hover:text-primary text-xl font-semibold tracking-tight wrap-anywhere">
                                {entry.title}
                            </h2>
                            {entry.excerpt ?
                                <p className="text-muted-foreground leading-7">{entry.excerpt}</p>
                            :   null}
                            <p className="text-muted-foreground text-sm">
                                <time dateTime={publishedAt.toISOString()}>{published}</time>
                            </p>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

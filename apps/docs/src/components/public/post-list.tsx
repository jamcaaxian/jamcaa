import Link from "next/link";
import type { PublicPostListItem } from "@/content/public-listing-protocol";

export function PostList({ entries, emptyMessage }: { entries: readonly PublicPostListItem[]; emptyMessage: string }) {
    if (entries.length === 0) {
        return <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-sm">{emptyMessage}</div>;
    }

    return (
        <ul className="divide-y">
            {entries.map(entry => (
                <li key={entry.id} className="py-7 first:pt-0">
                    <Link href={entry.address} prefetch={false} className="group block space-y-2">
                        <h2 className="group-hover:text-primary text-xl font-semibold tracking-tight wrap-anywhere">
                            {entry.title}
                        </h2>
                        {entry.excerpt ?
                            <p className="text-muted-foreground leading-7">{entry.excerpt}</p>
                        :   null}
                        <p className="text-muted-foreground text-sm">
                            <time dateTime={entry.published.dateTime}>{entry.published.label}</time>
                        </p>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

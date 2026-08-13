import Link from "next/link";
import type { PublicPostListItem } from "@/content/public-listing-protocol";

export function PostList({ entries, emptyMessage }: { entries: readonly PublicPostListItem[]; emptyMessage: string }) {
    if (entries.length === 0) {
        return (
            <div className="text-muted-foreground rounded-2xl border border-dashed px-8 py-16 text-center text-sm">
                {emptyMessage}
            </div>
        );
    }

    return (
        <ul className="divide-border/70 divide-y">
            {entries.map(entry => (
                <li key={entry.id} className="group py-8 first:pt-2 last:pb-0">
                    <Link
                        href={entry.address}
                        prefetch={false}
                        className="group/link -mx-3 flex items-baseline justify-between gap-6 rounded-xl px-3 py-1 transition-colors duration-200 ease-spring"
                    >
                        <div className="space-y-2">
                            <h2 className="group-hover/link:text-primary text-2xl font-semibold tracking-tight text-balance transition-colors duration-200 ease-spring sm:text-[1.75rem]">
                                {entry.title}
                            </h2>
                            {entry.excerpt ?
                                <p className="text-muted-foreground line-clamp-2 max-w-prose leading-7">
                                    {entry.excerpt}
                                </p>
                            :   null}
                        </div>
                        <p className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                            <time dateTime={entry.published.dateTime}>{entry.published.label}</time>
                        </p>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

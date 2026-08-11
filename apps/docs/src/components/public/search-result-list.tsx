import Link from "next/link";
import type { PostSearchResult } from "@/content/search";
import { postAddress } from "@/content/public-paths";

export function SearchResultList({
    results,
    permalink,
    emptyMessage
}: {
    results: PostSearchResult[];
    permalink: string;
    emptyMessage: string;
}) {
    if (results.length === 0) {
        return <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-sm">{emptyMessage}</div>;
    }

    return (
        <ol className="divide-y">
            {results.map(({ entry, excerpt }) => (
                <li key={entry.id} className="py-7 first:pt-0">
                    <Link href={postAddress(permalink, entry)} className="group block space-y-2">
                        <h2 className="group-hover:text-primary text-xl font-semibold tracking-tight wrap-anywhere">
                            {entry.title}
                        </h2>
                        {excerpt ?
                            <p className="text-muted-foreground line-clamp-3 leading-7">{excerpt}</p>
                        : entry.excerpt ?
                            <p className="text-muted-foreground line-clamp-3 leading-7">{entry.excerpt}</p>
                        :   null}
                    </Link>
                </li>
            ))}
        </ol>
    );
}

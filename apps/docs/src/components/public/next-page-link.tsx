import Link from "next/link";

export function NextPageLink({ path, cursor }: { path: string; cursor: string | undefined }) {
    if (cursor === undefined) {
        return null;
    }

    return (
        <Link
            href={`${path}?cursor=${encodeURIComponent(cursor)}`}
            className="border-input bg-background hover:bg-accent mt-10 inline-flex h-11 items-center rounded-lg border px-5 text-sm font-semibold"
        >
            Next page
        </Link>
    );
}

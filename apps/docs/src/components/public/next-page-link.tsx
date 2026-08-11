import Link from "next/link";
import type { FocusEventHandler } from "react";

export function NextPageLink({
    href,
    onFocus,
    onBlur
}: {
    href: string | null;
    onFocus?: FocusEventHandler<HTMLAnchorElement>;
    onBlur?: FocusEventHandler<HTMLAnchorElement>;
}) {
    if (href === null) {
        return null;
    }

    return (
        <Link
            href={href}
            prefetch={false}
            onFocus={onFocus}
            onBlur={onBlur}
            className="border-input bg-background hover:bg-accent inline-flex h-11 items-center rounded-lg border px-5 text-sm font-semibold"
        >
            Next page
        </Link>
    );
}

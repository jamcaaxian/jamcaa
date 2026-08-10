"use client";

import { Fragment, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { readAdminCrumb, subscribeToAdminCrumb } from "@/lib/admin-crumb";

function toLabel(segment: string) {
    return segment.replace(/-/g, " ").replace(/^\w/, character => character.toUpperCase());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_ID = /^[A-Za-z0-9]{20,}$/;

/** An identifier is not a name, and humanising one produces nonsense. */
function isIdentifier(segment: string) {
    return UUID.test(segment) || OPAQUE_ID.test(segment);
}

export function AdminBreadcrumb() {
    const path = usePathname().split("/").filter(Boolean).slice(1);
    const published = useSyncExternalStore(subscribeToAdminCrumb, readAdminCrumb, () => null);

    // Addresses are built from every segment, then the opaque ones are dropped, so
    // a crumb after an identifier still links to the right place.
    const items = path
        .map((segment, index) => ({
            key: segment,
            label: toLabel(segment),
            href: `/admin/${path.slice(0, index + 1).join("/")}`
        }))
        .filter(item => !isIdentifier(item.key));

    // A page named after an identifier can say what it is really called; anywhere
    // else the address already reads as a name and is left alone.
    const last = path.at(-1);

    if (published !== null && last !== undefined && isIdentifier(last)) {
        items.push({ key: last, label: published, href: `/admin/${path.join("/")}` });
    }

    return (
        <Breadcrumb className="min-w-0 overflow-hidden">
            <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
                <BreadcrumbItem className={items.length > 0 ? "hidden sm:inline-flex" : undefined}>
                    {items.length === 0 ?
                        <BreadcrumbPage>Overview</BreadcrumbPage>
                    :   <BreadcrumbLink render={<Link href="/admin" />}>Overview</BreadcrumbLink>}
                </BreadcrumbItem>

                {items.map((item, index) => (
                    <Fragment key={item.key}>
                        <BreadcrumbSeparator className={index < items.length - 2 ? "hidden sm:flex" : undefined} />
                        <BreadcrumbItem className={index < items.length - 2 ? "hidden sm:inline-flex" : "min-w-0"}>
                            {index === items.length - 1 ?
                                <BreadcrumbPage className="max-w-full truncate">{item.label}</BreadcrumbPage>
                            :   <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

"use client";

import { Fragment } from "react";
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
    // Addresses are built from every segment, then the opaque ones are dropped, so
    // a crumb after an identifier still links to the right place.
    const crumbs = path
        .map((segment, index) => ({ segment, href: `/admin/${path.slice(0, index + 1).join("/")}` }))
        .filter(crumb => !isIdentifier(crumb.segment));

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    {crumbs.length === 0 ?
                        <BreadcrumbPage>Overview</BreadcrumbPage>
                    :   <BreadcrumbLink render={<Link href="/admin" />}>Overview</BreadcrumbLink>}
                </BreadcrumbItem>

                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;

                    return (
                        <Fragment key={crumb.href}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {isLast ?
                                    <BreadcrumbPage>{toLabel(crumb.segment)}</BreadcrumbPage>
                                :   <BreadcrumbLink render={<Link href={crumb.href} />}>
                                        {toLabel(crumb.segment)}
                                    </BreadcrumbLink>
                                }
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

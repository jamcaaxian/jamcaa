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
    return segment.replace(/-/g, " ").replace(/^\w/, (character) => character.toUpperCase());
}

export function AdminBreadcrumb() {
    const segments = usePathname().split("/").filter(Boolean).slice(1);

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    {segments.length === 0 ? (
                        <BreadcrumbPage>Overview</BreadcrumbPage>
                    ) : (
                        <BreadcrumbLink render={<Link href="/admin" />}>Overview</BreadcrumbLink>
                    )}
                </BreadcrumbItem>

                {segments.map((segment, index) => {
                    const href = `/admin/${segments.slice(0, index + 1).join("/")}`;
                    const isLast = index === segments.length - 1;

                    return (
                        <Fragment key={href}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{toLabel(segment)}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink render={<Link href={href} />}>{toLabel(segment)}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

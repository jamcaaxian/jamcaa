import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Languages } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { counterServicePort } from "@jamcaaxian/core/counters";
import { DocsArticle } from "@/components/public/docs-article";
import { LocaleAddressPublisher } from "@/components/public/locale-address-publisher";
import { adjacentDocs } from "@/content/docs-navigation";
import { docsLocaleContext, docsLocales, localizedPath, type DocsLocale } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import {
    publicMoment,
    publicPageAt,
    publicPageLocaleAddresses,
    publicPostAddress,
    publicPostLocaleAddresses,
    publishedPostAt
} from "@/content/public-site";
import { currentConsoleActor } from "@/lib/console-access";
import { may, mayTouch } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function countView(entryId: string): void {
    try {
        const { env, ctx } = getCloudflareContext();

        if (env.COUNTERS === undefined) {
            return;
        }

        ctx.waitUntil(
            counterServicePort(env.COUNTERS)
                .increment({ collectionName: "post", entryId }, "view")
                .catch(() => undefined)
        );
    } catch {
        // Public rendering must not depend on best-effort telemetry.
    }
}

async function availableTranslations(path: string[], locale: DocsLocale) {
    const candidates = await Promise.all(
        docsLocales.definitions
            .filter(definition => definition.tag !== locale)
            .map(async definition => {
                const [resolution, page] = await Promise.all([
                    publishedPostAt(path, definition.tag),
                    publicPageAt(path, definition.tag)
                ]);

                if (page !== undefined) {
                    return { definition, address: localizedPath(definition.tag, page.address) };
                }

                return resolution?.kind === "entry" ?
                        {
                            definition,
                            address: localizedPath(definition.tag, await publicPostAddress(resolution.entry))
                        }
                    :   undefined;
            })
    );

    return candidates.filter(candidate => candidate !== undefined);
}

export async function generateMetadata({
    params
}: {
    params: Promise<{ locale: string; path: string[] }>;
}): Promise<Metadata> {
    const parameters = await params;
    const context = docsLocaleContext(parameters.locale);

    if (context === undefined) {
        return { title: "Page not found" };
    }

    const [resolution, page] = await Promise.all([
        publishedPostAt(parameters.path, context.locale),
        publicPageAt(parameters.path, context.locale)
    ]);

    if (page !== undefined) {
        const languages = await publicPageLocaleAddresses(page);
        const canonical = languages[context.locale] ?? localizedPath(context.locale, page.address);

        return { title: page.title, alternates: { canonical, languages } };
    }

    if (resolution?.kind !== "entry") {
        const available = await availableTranslations(parameters.path, context.locale);
        const messages = publicCopy(context.locale);

        return {
            title: available.length > 0 ? messages.notTranslatedTitle : messages.notFoundTitle,
            robots: { index: false },
            alternates: null
        };
    }

    const languages = await publicPostLocaleAddresses(resolution.entry);
    const canonical =
        languages[context.locale] ?? localizedPath(context.locale, await publicPostAddress(resolution.entry));

    return {
        title: resolution.entry.title,
        description: resolution.entry.excerpt ?? undefined,
        alternates: { canonical, languages },
        openGraph: {
            title: resolution.entry.title,
            description: resolution.entry.excerpt ?? undefined,
            type: "article",
            locale: context.locale.replaceAll("-", "_"),
            publishedTime: (resolution.entry.publishedAt ?? resolution.entry.createdAt).toISOString(),
            modifiedTime: resolution.entry.updatedAt.toISOString()
        }
    };
}

export default async function LocalizedPublicEntry({
    params
}: {
    params: Promise<{ locale: string; path: string[] }>;
}) {
    const parameters = await params;
    const context = docsLocaleContext(parameters.locale);

    if (context === undefined) {
        notFound();
    }

    const [resolution, page] = await Promise.all([
        publishedPostAt(parameters.path, context.locale),
        publicPageAt(parameters.path, context.locale)
    ]);

    if (page !== undefined) {
        const [updated, addresses, actor] = await Promise.all([
            publicMoment(page.updatedAt, context.locale),
            publicPageLocaleAddresses(page),
            currentConsoleActor()
        ]);
        const editAddress = actor && (await may(actor, "page", "update")) ? `/admin/pages/${page.id}` : undefined;
        const currentAddress = addresses[context.locale] ?? localizedPath(context.locale, page.address);

        return (
            <>
                <LocaleAddressPublisher addresses={addresses} />
                <DocsArticle
                    post={{ title: page.title, excerpt: null, body: page.body, updatedAt: page.updatedAt }}
                    locale={context.locale}
                    updatedLabel={updated.label}
                    currentAddress={currentAddress}
                    editAddress={editAddress}
                />
            </>
        );
    }

    if (resolution?.kind === "former") {
        permanentRedirect(localizedPath(context.locale, resolution.address));
    }

    if (resolution?.kind !== "entry") {
        const available = await availableTranslations(parameters.path, context.locale);

        if (available.length > 0) {
            const messages = publicCopy(context.locale);
            const translations = available.map(candidate => ({
                locale: candidate.definition.tag,
                label: candidate.definition.label,
                address: candidate.address
            }));

            return (
                <main
                    id="main-content"
                    className="mx-auto grid min-h-[70dvh] max-w-3xl place-items-center px-4 py-20 sm:px-6"
                >
                    <section className="w-full rounded-3xl border bg-card p-8 text-center shadow-soft sm:p-12">
                        <span className="bg-primary/10 text-primary mx-auto grid size-12 place-items-center rounded-2xl">
                            <Languages className="size-5" />
                        </span>
                        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{messages.notTranslatedTitle}</h1>
                        <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
                            {messages.notTranslatedDescription}
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            {translations.map(translation => (
                                <Link
                                    key={translation.locale}
                                    href={translation.address}
                                    className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold active:scale-[0.97]"
                                >
                                    {translation.label}
                                    <ArrowRight className="size-4" />
                                </Link>
                            ))}
                            <Link
                                href={localizedPath(context.locale)}
                                className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold active:scale-[0.97]"
                            >
                                {messages.returnHome}
                            </Link>
                        </div>
                    </section>
                </main>
            );
        }

        notFound();
    }

    countView(resolution.entry.id);

    const [updated, addresses, actor] = await Promise.all([
        publicMoment(resolution.entry.updatedAt, context.locale),
        publicPostLocaleAddresses(resolution.entry),
        currentConsoleActor()
    ]);
    const adjacent = adjacentDocs(resolution.entry.slug, context.locale);
    const editAddress =
        actor && (await mayTouch(actor, "post", "update", resolution.entry.authorId)) ?
            `/admin/posts/${resolution.entry.id}`
        :   undefined;
    const currentAddress = addresses[context.locale] ?? localizedPath(context.locale, `/${parameters.path.join("/")}`);

    return (
        <>
            <LocaleAddressPublisher addresses={addresses} />
            <DocsArticle
                post={resolution.entry}
                locale={context.locale}
                updatedLabel={updated.label}
                currentAddress={currentAddress}
                previous={
                    adjacent.previous ? { title: adjacent.previous.label, address: adjacent.previous.href } : undefined
                }
                next={adjacent.next ? { title: adjacent.next.label, address: adjacent.next.href } : undefined}
                editAddress={editAddress}
            />
        </>
    );
}

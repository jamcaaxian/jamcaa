import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, Braces, Globe2 } from "lucide-react";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DocsHomeBlocks } from "@/components/public/docs-home-blocks";
import { PostList } from "@/components/public/post-list";
import { docsLocaleContext, localeAlternates, localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { pages } from "@/content/pages-store";
import { publicPostListing } from "@/content/public-listing";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        return {};
    }

    const messages = publicCopy(context.locale);

    return {
        title: { absolute: "Jamcaa Docs" },
        description: messages.homeDescription,
        alternates: { canonical: localizedPath(context.locale), languages: localeAlternates("/", true) }
    };
}

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        return null;
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const messages = publicCopy(context.locale);
    const [home, summaryPage, settings] = await Promise.all([
        pages(database).byAddress("/", context.locale),
        postSummaries(database).list({ locale: context.locale, limit: 6 }),
        publicSiteSettings()
    ]);
    const listing = publicPostListing(summaryPage, {
        path: localizedPath(context.locale),
        locale: context.locale,
        permalink: settings.get("permalink.post"),
        datePattern: settings.get("format.date"),
        timePattern: settings.get("format.time")
    });

    return (
        <main id="main-content" className="overflow-hidden">
            <section className="relative border-b">
                <div aria-hidden="true" className="docs-hero-grid absolute inset-0 -z-10" />
                <div className="mx-auto grid max-w-384 gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:px-8 lg:py-32">
                    <div>
                        <p className="text-primary mb-5 text-sm font-semibold tracking-wide">{messages.homeEyebrow}</p>
                        <h1 className="max-w-4xl text-5xl leading-[0.98] font-semibold tracking-tighter text-balance sm:text-7xl">
                            {messages.homeTitle}
                        </h1>
                        <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-8 text-pretty sm:text-xl">
                            {messages.homeDescription}
                        </p>
                        <div className="mt-9 flex flex-wrap gap-3">
                            <Link
                                href={localizedPath(context.locale, "/getting-started")}
                                className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-soft transition-[transform,background-color] duration-150 hover:bg-primary/85 active:scale-[0.97]"
                            >
                                {messages.getStarted}
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link
                                href={localizedPath(context.locale, "/docs")}
                                className="bg-background/75 hover:bg-accent inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold backdrop-blur transition-[transform,background-color] duration-150 active:scale-[0.97]"
                            >
                                {messages.exploreDocs}
                            </Link>
                        </div>
                    </div>

                    <div className="docs-code-window bg-card/88 overflow-hidden rounded-3xl border shadow-lifted backdrop-blur-xl">
                        <div className="border-b px-5 py-3">
                            <div className="flex items-center gap-2" aria-hidden="true">
                                <span className="size-2.5 rounded-full bg-rose-400" />
                                <span className="size-2.5 rounded-full bg-amber-400" />
                                <span className="size-2.5 rounded-full bg-emerald-400" />
                            </div>
                        </div>
                        <pre className="overflow-x-auto p-6 font-mono text-[0.82rem] leading-7 sm:p-7">
                            <code>
                                <span className="text-primary">const</span>
                                {" post = defineCollection({\n  name: "}
                                <span className="text-emerald-600 dark:text-emerald-400">&quot;post&quot;</span>
                                {",\n  fields: {\n    title: text({ required: "}
                                <span className="text-primary">true</span>
                                {" }),\n    body: blocks({ registry })\n  },\n  search: { fields: ["}
                                <span className="text-emerald-600 dark:text-emerald-400">&quot;title&quot;</span>
                                {", "}
                                <span className="text-emerald-600 dark:text-emerald-400">&quot;body&quot;</span>
                                {"] }\n});"}
                            </code>
                        </pre>
                        <div className="border-t px-6 py-4 text-sm text-muted-foreground">
                            {messages.builtWithJamcaa}
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-384 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
                <div className="max-w-3xl">
                    <p className="text-primary mb-3 text-sm font-semibold tracking-wide">
                        {messages.architectureEyebrow}
                    </p>
                    <h2 className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
                        {messages.architectureTitle}
                    </h2>
                    <p className="text-muted-foreground mt-5 text-lg leading-8 text-pretty">
                        {messages.architectureDescription}
                    </p>
                </div>

                {home ?
                    <DocsHomeBlocks document={home.body} />
                :   <div className="mt-12 grid gap-4 md:grid-cols-3">
                        {[Boxes, Braces, Globe2].map((Icon, index) => (
                            <div key={index} className="rounded-3xl border bg-card p-7 shadow-soft">
                                <Icon className="text-primary size-5" />
                                <div className="bg-muted mt-8 h-4 w-2/3 rounded" />
                                <div className="bg-muted mt-3 h-3 w-full rounded" />
                                <div className="bg-muted mt-2 h-3 w-5/6 rounded" />
                            </div>
                        ))}
                    </div>
                }
            </section>

            <section className="border-t bg-card/45">
                <div className="mx-auto max-w-384 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
                    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-3xl font-semibold tracking-tight">{messages.latestTitle}</h2>
                            <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
                                {messages.latestDescription}
                            </p>
                        </div>
                        <Link
                            className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
                            href={localizedPath(context.locale, "/docs")}
                        >
                            {messages.exploreDocs}
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                    <PostList entries={listing.items} emptyMessage={messages.noPosts} />
                </div>
            </section>
        </main>
    );
}

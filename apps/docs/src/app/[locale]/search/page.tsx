import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SearchResultList } from "@/components/public/search-result-list";
import { docsLocaleContext, localeAlternates, localizedPath, type DocsLocale } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { publicSiteSettings } from "@/content/public-site";
import { searchPosts } from "@/content/search";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        return {};
    }

    const path = "/search";

    return {
        title: publicCopy(context.locale).searchTitle,
        alternates: { canonical: localizedPath(context.locale, path), languages: localeAlternates(path) }
    };
}

type SearchParameters = Promise<{ q?: string; category?: string; tag?: string; cursor?: string }>;

function searchAddress(
    locale: DocsLocale,
    parameters: { q: string; category?: string; tag?: string; cursor?: string }
): string {
    const query = new URLSearchParams({ q: parameters.q });

    if (parameters.category) query.set("category", parameters.category);
    if (parameters.tag) query.set("tag", parameters.tag);
    if (parameters.cursor) query.set("cursor", parameters.cursor);

    return `${localizedPath(locale, "/search")}?${query.toString()}`;
}

export default async function LocalizedSearchPage({
    params,
    searchParams
}: {
    params: Promise<{ locale: string }>;
    searchParams: SearchParameters;
}) {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        notFound();
    }

    const parameters = await searchParams;
    const query = parameters.q?.trim() ?? "";
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const terms = taxonomy(database);
    const messages = publicCopy(context.locale);
    const [settings, categories, tags] = await Promise.all([
        publicSiteSettings(),
        terms.listCategories(),
        terms.listTags()
    ]);
    const category = parameters.category ? await terms.categoryBySlug(parameters.category) : undefined;
    const tag = parameters.tag ? await terms.tagBySlug(parameters.tag) : undefined;
    const hasUnknownFilter =
        (parameters.category !== undefined && category === undefined)
        || (parameters.tag !== undefined && tag === undefined);
    let page: Awaited<ReturnType<typeof searchPosts>> = { results: [] };
    let searchProblem: string | undefined;

    if (query && !hasUnknownFilter) {
        try {
            page = await searchPosts(database, {
                query,
                locale: context.locale,
                filters: { categoryId: category?.id, tagId: tag?.id },
                cursor: parameters.cursor
            });
        } catch (error) {
            if (error instanceof Error && error.message === "The search cursor is invalid.") {
                searchProblem = messages.invalidSearchCursor;
            } else {
                throw error;
            }
        }
    }

    const action = localizedPath(context.locale, "/search");

    return (
        <main id="main-content" className="mx-auto min-h-[70dvh] max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
            <header className="mb-10 max-w-2xl">
                <p className="text-primary text-sm font-semibold">Jamcaa Docs</p>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                    {messages.searchTitle}
                </h1>
                <p className="text-muted-foreground mt-4 text-lg leading-8">{messages.searchDescription}</p>
            </header>

            <form
                action={action}
                className="mb-12 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
                <label className="grid gap-1.5 sm:col-span-4">
                    <span className="text-sm font-medium">{messages.searchTerms}</span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder={messages.searchPlaceholder}
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
                    />
                </label>
                <label className="grid min-w-0 gap-1.5">
                    <span className="text-sm font-medium">{messages.category}</span>
                    <select
                        name="category"
                        defaultValue={category?.slug ?? ""}
                        className="border-input bg-background h-11 min-w-0 rounded-lg border px-3 text-sm"
                    >
                        <option value="">{messages.allCategories}</option>
                        {categories.map(candidate => (
                            <option key={candidate.id} value={candidate.slug}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1.5">
                    <span className="text-sm font-medium">{messages.tag}</span>
                    <select
                        name="tag"
                        defaultValue={tag?.slug ?? ""}
                        className="border-input bg-background h-11 min-w-0 rounded-lg border px-3 text-sm"
                    >
                        <option value="">{messages.allTags}</option>
                        {tags.map(candidate => (
                            <option key={candidate.id} value={candidate.slug}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="submit"
                    className="bg-primary text-primary-foreground h-11 self-end rounded-lg px-5 text-sm font-semibold active:scale-[0.97]"
                >
                    {messages.search}
                </button>
                <Link
                    href={action}
                    className="bg-secondary text-secondary-foreground flex h-11 items-center justify-center self-end rounded-lg px-5 text-sm font-semibold active:scale-[0.97]"
                >
                    {messages.clear}
                </Link>
            </form>

            {query ?
                <section aria-labelledby="search-results" className="space-y-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 id="search-results" className="text-xl font-semibold tracking-tight">
                            {messages.resultsFor} “{query}”
                        </h2>
                        {(category || tag) && (
                            <p className="text-muted-foreground text-sm">
                                {[category?.name, tag?.name].filter(Boolean).join(" · ")}
                            </p>
                        )}
                    </div>
                    {searchProblem ?
                        <div role="alert" className="text-destructive rounded-xl border border-dashed p-8 text-sm">
                            {searchProblem}
                        </div>
                    :   <SearchResultList
                            results={page.results}
                            permalink={settings.get("permalink.post")}
                            emptyMessage={messages.noResults}
                            locale={context.locale}
                        />
                    }
                    {page.nextCursor && (
                        <Link
                            href={searchAddress(context.locale, {
                                q: query,
                                category: category?.slug,
                                tag: tag?.slug,
                                cursor: page.nextCursor
                            })}
                            className="border-input bg-background hover:bg-accent inline-flex h-11 items-center rounded-lg border px-5 text-sm font-semibold"
                        >
                            {messages.nextPage}
                        </Link>
                    )}
                </section>
            :   <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-sm">
                    {messages.enterSearch}
                </div>
            }
        </main>
    );
}

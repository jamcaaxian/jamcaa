import Link from "next/link";
import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SearchResultList } from "@/components/public/search-result-list";
import { publicSiteSettings } from "@/content/public-site";
import { searchPosts } from "@/content/search";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

type SearchParameters = Promise<{ q?: string; category?: string; tag?: string; cursor?: string }>;

function searchAddress(parameters: { q: string; category?: string; tag?: string; cursor?: string }): string {
    const query = new URLSearchParams({ q: parameters.q });

    if (parameters.category) query.set("category", parameters.category);
    if (parameters.tag) query.set("tag", parameters.tag);
    if (parameters.cursor) query.set("cursor", parameters.cursor);

    return `/search?${query.toString()}`;
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParameters }) {
    const parameters = await searchParams;
    const query = parameters.q?.trim() ?? "";
    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const terms = taxonomy(database);
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
                filters: { categoryId: category?.id, tagId: tag?.id },
                cursor: parameters.cursor
            });
        } catch (error) {
            if (error instanceof Error && error.message === "The search cursor is invalid.") {
                searchProblem = "This result page address is invalid or has expired. Start the search again.";
            } else {
                throw error;
            }
        }
    }

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-14 sm:px-6 sm:py-24">
            <header className="mb-10 space-y-3">
                <Link href="/" className="text-primary text-sm font-semibold tracking-tight">
                    {settings.get("site.title")}
                </Link>
                <p className="text-muted-foreground text-sm font-medium">Search</p>
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                    Find published Posts.
                </h1>
                <p className="text-muted-foreground max-w-xl leading-7">
                    Search declared public text, then narrow results by Category or Tag.
                </p>
            </header>

            <form
                action="/search"
                className="mb-12 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
                <label className="grid gap-1.5 sm:col-span-4">
                    <span className="text-sm font-medium">Search terms</span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Search published Posts"
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
                    />
                </label>
                <label className="grid min-w-0 gap-1.5">
                    <span className="text-sm font-medium">Category</span>
                    <select
                        name="category"
                        defaultValue={category?.slug ?? ""}
                        className="border-input bg-background h-11 min-w-0 rounded-lg border px-3 text-sm"
                    >
                        <option value="">All Categories</option>
                        {categories.map(candidate => (
                            <option key={candidate.id} value={candidate.slug}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-0 gap-1.5">
                    <span className="text-sm font-medium">Tag</span>
                    <select
                        name="tag"
                        defaultValue={tag?.slug ?? ""}
                        className="border-input bg-background h-11 min-w-0 rounded-lg border px-3 text-sm"
                    >
                        <option value="">All Tags</option>
                        {tags.map(candidate => (
                            <option key={candidate.id} value={candidate.slug}>
                                {candidate.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="submit"
                    className="bg-primary text-primary-foreground h-11 self-end rounded-lg px-5 text-sm font-semibold"
                >
                    Search
                </button>
                <Link
                    href="/search"
                    className="bg-secondary text-secondary-foreground flex h-11 items-center justify-center self-end rounded-lg px-5 text-sm font-semibold"
                >
                    Clear
                </Link>
            </form>

            {query ?
                <section aria-labelledby="search-results" className="space-y-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2 id="search-results" className="text-xl font-semibold tracking-tight">
                            Results for “{query}”
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
                            emptyMessage="No published Posts match this search."
                        />
                    }
                    {page.nextCursor && (
                        <Link
                            href={searchAddress({
                                q: query,
                                category: category?.slug,
                                tag: tag?.slug,
                                cursor: page.nextCursor
                            })}
                            className="border-input bg-background hover:bg-accent inline-flex h-11 items-center rounded-lg border px-5 text-sm font-semibold"
                        >
                            Next page
                        </Link>
                    )}
                </section>
            :   <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-sm">
                    Enter one or more terms to search Published Entries.
                </div>
            }
        </main>
    );
}

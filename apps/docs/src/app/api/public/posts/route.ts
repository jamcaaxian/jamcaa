import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isInvalidEntrySummaryCursor, publicPostListing } from "@/content/public-listing";
import { docsLocales, localizedPath } from "@/content/locales";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";
import { taxonomy } from "@/content/taxonomy";

export const dynamic = "force-dynamic";

function problem(status: number, message: string) {
    return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const cursors = url.searchParams.getAll("cursor");
    const categories = url.searchParams.getAll("category");
    const tags = url.searchParams.getAll("tag");
    const locales = url.searchParams.getAll("locale");

    if (cursors.length !== 1 || categories.length > 1 || tags.length > 1 || locales.length > 1) {
        return problem(400, "Describe exactly one public list page.");
    }

    const cursor = cursors[0];
    const categorySlug = categories[0];
    const tagSlug = tags[0];
    const locale = locales[0] === undefined ? undefined : docsLocales.canonical(locales[0]);

    if (!cursor) {
        return problem(400, "Name the public list page to read.");
    }

    if (locales.length === 1 && locale === undefined) {
        return problem(400, "Name a supported Locale to read.");
    }

    if ((categories.length === 1 && !categorySlug) || (tags.length === 1 && !tagSlug)) {
        return problem(400, "Name the public archive to read.");
    }

    if (categorySlug && tagSlug) {
        return problem(400, "A public list page cannot be both a Category and a Tag archive.");
    }

    const { env } = getCloudflareContext();
    const database = createDatabase(env.DB);
    const terms = taxonomy(database);
    const [category, tag] = await Promise.all([
        categorySlug ? terms.categoryBySlug(categorySlug) : undefined,
        tagSlug ? terms.tagBySlug(tagSlug) : undefined
    ]);

    if (categorySlug && category === undefined) {
        return problem(404, "That Category does not exist.");
    }

    if (tagSlug && tag === undefined) {
        return problem(404, "That Tag does not exist.");
    }

    try {
        const [page, settings] = await Promise.all([
            postSummaries(database).list({ categoryId: category?.id, tagId: tag?.id, locale, limit: 20, cursor }),
            publicSiteSettings()
        ]);
        const unlocalizedPath =
            category ? `/category/${category.slug}`
            : tag ? `/tag/${tag.slug}`
            : "/";
        const path = locale === undefined ? unlocalizedPath : localizedPath(locale, unlocalizedPath);

        return Response.json(
            publicPostListing(page, {
                path,
                cursor,
                categorySlug: category?.slug,
                tagSlug: tag?.slug,
                permalink: settings.get("permalink.post"),
                datePattern: settings.get("format.date"),
                timePattern: settings.get("format.time"),
                locale
            }),
            { headers: { "cache-control": "no-store" } }
        );
    } catch (error) {
        if (isInvalidEntrySummaryCursor(error)) {
            return problem(404, "That public list page address is invalid.");
        }

        throw error;
    }
}

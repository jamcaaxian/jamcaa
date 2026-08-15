import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { docsLocaleContext } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";
import { jsonFeed } from "@/content/feed";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
    const context = docsLocaleContext((await params).locale);

    if (context === undefined) {
        return Response.json({ error: "Unsupported Locale." }, { status: 404 });
    }

    const { env } = getCloudflareContext();
    const [page, settings] = await Promise.all([
        postSummaries(createDatabase(env.DB)).list({ locale: context.locale, limit: 50 }),
        publicSiteSettings()
    ]);
    const messages = publicCopy(context.locale);
    const feed = jsonFeed({
        origin: new URL(request.url).origin,
        title: `${settings.get("site.title")} — ${messages.languageName}`,
        description: messages.homeDescription,
        permalink: settings.get("permalink.post"),
        summaries: page.summaries,
        locale: context.locale
    });

    return Response.json(feed, {
        headers: { "content-type": "application/feed+json; charset=utf-8", "content-language": context.locale }
    });
}

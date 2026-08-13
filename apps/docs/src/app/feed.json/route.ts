import { createDatabase } from "@jamcaaxian/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonFeed } from "@/content/feed";
import { publicSiteSettings } from "@/content/public-site";
import { postSummaries } from "@/content/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { env } = getCloudflareContext();
    const [page, settings] = await Promise.all([
        postSummaries(createDatabase(env.DB)).list({ limit: 50 }),
        publicSiteSettings()
    ]);

    const feed = jsonFeed({
        origin: new URL(request.url).origin,
        title: settings.get("site.title"),
        description: settings.get("site.description"),
        permalink: settings.get("permalink.post"),
        summaries: page.summaries
    });

    return Response.json(feed, { headers: { "content-type": "application/feed+json; charset=utf-8" } });
}

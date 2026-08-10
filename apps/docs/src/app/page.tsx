import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaa/core";
import { posts } from "@/content/store";

export const dynamic = "force-dynamic";

export default async function Home() {
    const { env } = getCloudflareContext();
    const entries = await posts(createDatabase(env.DB)).list({ status: "published", limit: 20 });

    return (
        <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 sm:py-24">
            <header className="mb-14 space-y-3">
                <Link href="/" className="text-primary text-sm font-semibold tracking-tight">
                    jamcaa
                </Link>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Published with the platform.</h1>
                <p className="text-muted-foreground max-w-xl text-lg leading-8">
                    The documentation site uses the same Collection, Entry, Media, and publishing interfaces it
                    demonstrates.
                </p>
            </header>

            {entries.length === 0 ?
                <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                    No Posts have been published yet.
                </div>
            :   <ul className="divide-y">
                    {entries.map(entry => (
                        <li key={entry.id} className="py-7 first:pt-0">
                            <Link href={`/posts/${entry.slug}`} className="group block space-y-2">
                                <h2 className="text-xl font-semibold tracking-tight group-hover:text-primary">
                                    {entry.title}
                                </h2>
                                {entry.excerpt ?
                                    <p className="text-muted-foreground leading-7">{entry.excerpt}</p>
                                :   null}
                            </Link>
                        </li>
                    ))}
                </ul>
            }
        </main>
    );
}

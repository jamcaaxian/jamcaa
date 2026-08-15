import { BuiltinBlockView } from "@jamcaaxian/editor/blocks";
import type { BlockDocument } from "@jamcaaxian/core/content";
import { visibleSiteDocument } from "@/content/site-blocks";

/** Renders a Page body as its sequence of Blocks. */
export function PageContent({ title, body }: { title: string; body: BlockDocument }) {
    const document = visibleSiteDocument(body);

    return (
        <main id="main-content" className="mx-auto min-h-dvh max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
            <article>
                <header className="border-border/70 mb-12 border-b pb-10">
                    <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                        {title}
                    </h1>
                </header>
                <div>
                    {document.blocks.map(block => (
                        <BuiltinBlockView key={block.id} block={block} />
                    ))}
                </div>
            </article>
        </main>
    );
}

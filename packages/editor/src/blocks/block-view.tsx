import type { BlockInstance } from "@jamcaaxian/core/content";
import { RichTextContent } from "../content";

/**
 * Server-side rendering for the built-in Blocks. A Site composes these views
 * with its own media addressing and theme; unknown types render as a neutral
 * placeholder so a missing plugin never breaks a page.
 */
export function BuiltinBlockView({
    block,
    mediaAddress = mediaId => `/media/${encodeURIComponent(mediaId)}`
}: {
    block: BlockInstance;
    mediaAddress?: (mediaId: string) => string;
}) {
    switch (block.type) {
        case "builtin.heading": {
            const { text, level } = block.props as { text: string; level: number };
            const Level = (
                level === 1 ? "h1"
                : level === 3 ? "h3"
                : "h2") as "h1" | "h2" | "h3";

            return (
                <Level className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                    {text}
                </Level>
            );
        }
        case "builtin.paragraph": {
            const { text } = block.props as { text: string };

            return <p className="my-4 max-w-prose leading-8 text-pretty">{text}</p>;
        }
        case "builtin.richText": {
            const { document } = block.props as { document: Parameters<typeof RichTextContent>[0]["document"] };

            return <RichTextContent document={document} mediaAddress={mediaAddress} />;
        }
        case "builtin.image": {
            const { mediaId, alt, caption } = block.props as { mediaId: string; alt: string; caption: string };

            return (
                <figure className="my-8">
                    <img src={mediaAddress(mediaId)} alt={alt} className="rounded-2xl" />
                    {caption ?
                        <figcaption className="text-muted-foreground mt-2 text-center text-sm">{caption}</figcaption>
                    :   null}
                </figure>
            );
        }
        case "builtin.quote": {
            const { text, attribution } = block.props as { text: string; attribution: string };

            return (
                <blockquote className="border-primary/30 my-8 border-l-2 pl-6">
                    <p className="text-lg leading-8 text-pretty">{text}</p>
                    {attribution ?
                        <footer className="text-muted-foreground mt-2 text-sm">— {attribution}</footer>
                    :   null}
                </blockquote>
            );
        }
        case "builtin.code": {
            const { language, code } = block.props as { language: string; code: string };

            return (
                <pre className="bg-muted my-6 overflow-x-auto rounded-xl p-4 font-mono text-sm leading-6">
                    {language ?
                        <div className="text-muted-foreground mb-2 text-xs">{language}</div>
                    :   null}
                    <code>{code}</code>
                </pre>
            );
        }
        case "builtin.button": {
            const { label, href, variant } = block.props as { label: string; href: string; variant: string };

            return (
                <a
                    href={href}
                    className={
                        variant === "secondary" ?
                            "bg-secondary text-secondary-foreground hover:bg-secondary/70 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ease-spring"
                        :   "bg-primary text-primary-foreground hover:bg-primary/85 inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ease-spring"
                    }
                >
                    {label}
                </a>
            );
        }
        case "builtin.divider": {
            return <hr className="border-border my-10" />;
        }
        case "builtin.spacer": {
            const { size } = block.props as { size: number };

            return <div aria-hidden="true" style={{ height: `${size * 1.5}rem` }} />;
        }
        default: {
            return (
                <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                    Unknown block “{block.type}”.
                </div>
            );
        }
    }
}

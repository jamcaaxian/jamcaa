import type { ComponentType, ReactNode } from "react";
import type { BlockDocument, BlockInstance } from "@jamcaaxian/core/content";
import { RichTextContent } from "../content";

export interface BlockViewContext {
    mediaAddress: (mediaId: string) => string;
    headingId?: (heading: { level: number; text: string }) => string | undefined;
}

export interface BlockViewProps {
    block: BlockInstance;
    context: BlockViewContext;
}

export interface BlockViewDefinition {
    type: string;
    render: ComponentType<BlockViewProps>;
}

export interface BlockViewRegistry {
    render(block: BlockInstance, context: BlockViewContext): ReactNode;
}

export function createBlockViewRegistry(
    definitions: readonly BlockViewDefinition[],
    fallback: ComponentType<BlockViewProps> = UnknownBlockView
): BlockViewRegistry {
    const views = new Map<string, ComponentType<BlockViewProps>>();

    for (const definition of definitions) {
        if (views.has(definition.type)) {
            throw new Error(`Block View "${definition.type}" is registered twice.`);
        }

        views.set(definition.type, definition.render);
    }

    return {
        render(block, context) {
            const View = views.get(block.type) ?? fallback;

            return <View block={block} context={context} />;
        }
    };
}

function HeadingView({ block, context }: BlockViewProps) {
    const { text, level } = block.props as { text: string; level: number };
    const Level = (
        level === 1 ? "h1"
        : level === 3 ? "h3"
        : "h2") as "h1" | "h2" | "h3";

    return (
        <Level
            id={context.headingId?.({ level, text })}
            className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
            {text}
        </Level>
    );
}

function ParagraphView({ block }: BlockViewProps) {
    return <p className="my-4 max-w-prose leading-8 text-pretty">{String(block.props.text ?? "")}</p>;
}

function RichTextView({ block, context }: BlockViewProps) {
    return (
        <RichTextContent
            document={block.props.document as Parameters<typeof RichTextContent>[0]["document"]}
            mediaAddress={context.mediaAddress}
            headingId={context.headingId}
        />
    );
}

function ImageView({ block, context }: BlockViewProps) {
    const { mediaId, alt, caption } = block.props as { mediaId: string; alt: string; caption: string };

    return (
        <figure className="my-8">
            <img src={context.mediaAddress(mediaId)} alt={alt} loading="lazy" className="rounded-2xl" />
            {caption ?
                <figcaption className="text-muted-foreground mt-2 text-center text-sm">{caption}</figcaption>
            :   null}
        </figure>
    );
}

function QuoteView({ block }: BlockViewProps) {
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

function CodeView({ block }: BlockViewProps) {
    const { language, code } = block.props as { language: string; code: string };

    return (
        <div className="bg-muted my-6 overflow-hidden rounded-xl border">
            {language ?
                <div className="text-muted-foreground border-b px-4 py-2 font-mono text-xs">{language}</div>
            :   null}
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-6">
                <code>{code}</code>
            </pre>
        </div>
    );
}

function ButtonView({ block }: BlockViewProps) {
    const { label, href, variant } = block.props as { label: string; href: string; variant: string };
    const className =
        variant === "secondary" ? "bg-secondary text-secondary-foreground hover:bg-secondary/70"
        : variant === "tertiary" ? "text-primary hover:bg-primary/8"
        : "bg-primary text-primary-foreground hover:bg-primary/85";

    return (
        <a
            href={href}
            className={`${className} inline-flex min-h-11 items-center rounded-full px-5 py-2 text-sm font-medium transition-[background-color,transform] duration-200 ease-spring active:scale-[0.97]`}
        >
            {label}
        </a>
    );
}

const calloutStyles: Record<string, string> = {
    note: "border-primary/20 bg-primary/6",
    tip: "border-emerald-500/20 bg-emerald-500/7",
    warning: "border-amber-500/25 bg-amber-500/8",
    important: "border-rose-500/20 bg-rose-500/7"
};

function CalloutView({ block }: BlockViewProps) {
    const { tone, title, body } = block.props as { tone: string; title: string; body: string };

    return (
        <aside className={`${calloutStyles[tone] ?? calloutStyles.note} my-6 rounded-2xl border px-5 py-4`}>
            {title ?
                <strong className="block text-sm font-semibold">{title}</strong>
            :   null}
            <p className="mt-1 leading-7 text-pretty">{body}</p>
        </aside>
    );
}

function FeatureView({ block }: BlockViewProps) {
    const { eyebrow, title, description, href } = block.props as {
        eyebrow: string;
        title: string;
        description: string;
        href: string;
    };

    return (
        <a
            href={href}
            className="group bg-card hover:bg-accent/55 my-4 block rounded-2xl border p-6 shadow-soft transition-[background-color,transform,box-shadow] duration-200 ease-spring hover:-translate-y-0.5 hover:shadow-lifted active:scale-[0.99]"
        >
            {eyebrow ?
                <span className="text-primary text-xs font-semibold tracking-[0.08em] uppercase">{eyebrow}</span>
            :   null}
            <strong className="mt-2 block text-lg font-semibold tracking-tight">{title}</strong>
            <p className="text-muted-foreground mt-2 leading-7 text-pretty">{description}</p>
        </a>
    );
}

function StatView({ block }: BlockViewProps) {
    const { value, label, detail } = block.props as { value: string; label: string; detail: string };

    return (
        <div className="my-4 rounded-2xl border bg-card p-6 shadow-soft">
            <strong className="block font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</strong>
            <span className="mt-2 block text-sm font-medium">{label}</span>
            {detail ?
                <small className="text-muted-foreground mt-1 block leading-6">{detail}</small>
            :   null}
        </div>
    );
}

function DividerView() {
    return <hr className="border-border my-10" />;
}

function SpacerView({ block }: BlockViewProps) {
    const { size } = block.props as { size: number };

    return <div aria-hidden="true" style={{ height: `${size * 1.5}rem` }} />;
}

function UnknownBlockView({ block }: BlockViewProps) {
    return (
        <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
            Unknown block “{block.type}”.
        </div>
    );
}

export const builtinBlockViews: readonly BlockViewDefinition[] = [
    { type: "builtin.heading", render: HeadingView },
    { type: "builtin.paragraph", render: ParagraphView },
    { type: "builtin.richText", render: RichTextView },
    { type: "builtin.image", render: ImageView },
    { type: "builtin.quote", render: QuoteView },
    { type: "builtin.code", render: CodeView },
    { type: "builtin.button", render: ButtonView },
    { type: "builtin.callout", render: CalloutView },
    { type: "builtin.feature", render: FeatureView },
    { type: "builtin.stat", render: StatView },
    { type: "builtin.divider", render: DividerView },
    { type: "builtin.spacer", render: SpacerView }
];

export const builtinBlockViewRegistry = createBlockViewRegistry(builtinBlockViews);

export function BlockDocumentView({
    document,
    registry = builtinBlockViewRegistry,
    mediaAddress = mediaId => `/media/${encodeURIComponent(mediaId)}`,
    headingId,
    className
}: {
    document: BlockDocument;
    registry?: BlockViewRegistry;
    mediaAddress?: (mediaId: string) => string;
    headingId?: (heading: { level: number; text: string }) => string | undefined;
    className?: string;
}) {
    const context = { mediaAddress, headingId };

    return (
        <div className={className}>
            {document.blocks.map(block => (
                <div data-block-type={block.type} key={block.id}>
                    {registry.render(block, context)}
                </div>
            ))}
        </div>
    );
}

export function BuiltinBlockView({
    block,
    mediaAddress = mediaId => `/media/${encodeURIComponent(mediaId)}`
}: {
    block: BlockInstance;
    mediaAddress?: (mediaId: string) => string;
}) {
    return builtinBlockViewRegistry.render(block, { mediaAddress });
}

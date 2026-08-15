import { ArrowUpRight, Blocks, Braces, CheckCircle2, Database, Globe2, Sparkles } from "lucide-react";
import type { BlockDocument } from "@jamcaaxian/core/content";
import {
    BlockDocumentView,
    builtinBlockViews,
    createBlockViewRegistry,
    type BlockViewProps
} from "@jamcaaxian/editor/blocks";

function FeatureView({ block }: BlockViewProps) {
    const { eyebrow, title, description, href } = block.props as {
        eyebrow: string;
        title: string;
        description: string;
        href: string;
    };
    const Icon =
        eyebrow === "Blocks" ? Blocks
        : eyebrow === "BCP 47" ? Globe2
        : Database;
    const action = href.startsWith("/zh-hans-cn/") ? "查看详情" : "Explore";

    return (
        <a
            href={href}
            className="group bg-card hover:bg-accent/45 flex h-full flex-col rounded-3xl border p-7 shadow-soft transition-[transform,box-shadow,background-color] duration-200 ease-spring-snappy hover:-translate-y-0.5 hover:shadow-lifted active:scale-[0.99]"
        >
            <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-2xl">
                <Icon className="size-5" />
            </span>
            <span className="text-primary mt-7 text-xs font-semibold tracking-wide uppercase">{eyebrow}</span>
            <strong className="mt-2 block text-xl font-semibold tracking-tight text-balance">{title}</strong>
            <p className="text-muted-foreground mt-3 flex-1 leading-7 text-pretty">{description}</p>
            <span className="text-foreground mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
                {action}{" "}
                <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
        </a>
    );
}

function StatView({ block }: BlockViewProps) {
    const { value, label, detail } = block.props as { value: string; label: string; detail: string };

    return (
        <div className="bg-foreground text-background h-full rounded-3xl p-7 shadow-lifted">
            <Braces className="text-background/50 size-5" />
            <strong className="mt-8 block font-mono text-4xl font-semibold tracking-tight tabular-nums">{value}</strong>
            <span className="mt-3 block text-sm font-semibold">{label}</span>
            <small className="text-background/60 mt-2 block leading-6">{detail}</small>
        </div>
    );
}

function CalloutView({ block }: BlockViewProps) {
    const { title, body } = block.props as { title: string; body: string };

    return (
        <aside className="border-primary/20 bg-primary/6 flex flex-col gap-5 rounded-3xl border p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
                <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-2xl shadow-soft">
                    <Sparkles className="size-5" />
                </span>
                <div>
                    <strong className="block text-lg font-semibold tracking-tight">{title}</strong>
                    <p className="text-muted-foreground mt-2 max-w-3xl leading-7 text-pretty">{body}</p>
                </div>
            </div>
            <CheckCircle2 className="text-primary hidden size-6 shrink-0 sm:block" />
        </aside>
    );
}

const overridden = new Set(["builtin.feature", "builtin.stat", "builtin.callout"]);
const registry = createBlockViewRegistry([
    ...builtinBlockViews.filter(view => !overridden.has(view.type)),
    { type: "builtin.feature", render: FeatureView },
    { type: "builtin.stat", render: StatView },
    { type: "builtin.callout", render: CalloutView }
]);

export function DocsHomeBlocks({ document }: { document: BlockDocument }) {
    return (
        <BlockDocumentView
            document={document}
            registry={registry}
            className="docs-home-blocks mt-12"
            mediaAddress={mediaId => `/media/${encodeURIComponent(mediaId)}`}
        />
    );
}

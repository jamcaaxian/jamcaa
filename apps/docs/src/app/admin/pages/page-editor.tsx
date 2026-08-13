"use client";

import { useActionState, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { builtinBlocks } from "@jamcaaxian/editor/blocks";
import type { BlockDefinition, BlockInstance } from "@jamcaaxian/core/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PageFormState } from "./actions";

const INSERTABLE = Object.values(builtinBlocks).filter(block => block.name !== "builtin.richText");

function newBlock(type: string): BlockInstance {
    const definition = builtinBlocks[type as keyof typeof builtinBlocks] as BlockDefinition | undefined;
    const props: Record<string, unknown> = {};

    for (const [key, declaration] of Object.entries(definition?.props ?? {})) {
        if (declaration.default !== undefined) {
            props[key] = declaration.default;
        }
    }

    if (type === "builtin.richText") {
        props.document = { type: "doc", content: [{ type: "paragraph" }] };
    }

    return { id: crypto.randomUUID(), type, props };
}

function PropField({
    block,
    propName,
    onChange
}: {
    block: BlockInstance;
    propName: string;
    onChange: (value: unknown) => void;
}) {
    const definition = builtinBlocks[block.type as keyof typeof builtinBlocks] as BlockDefinition;
    const declaration = definition.props[propName];
    const value = block.props[propName];

    if (declaration.kind === "flag") {
        return (
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
                {declaration.label}
            </label>
        );
    }

    if (declaration.kind === "number") {
        return (
            <Input
                type="number"
                value={Number(value ?? 0)}
                onChange={event => onChange(Number(event.target.value))}
                aria-label={declaration.label}
            />
        );
    }

    if (declaration.kind === "color") {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={String(value ?? "#3388FF")}
                    onChange={event => onChange(event.target.value)}
                    className="size-8 cursor-pointer rounded-md border"
                    aria-label={declaration.label}
                />
                <Input
                    value={String(value ?? "")}
                    onChange={event => onChange(event.target.value)}
                    aria-label={declaration.label}
                />
            </div>
        );
    }

    const long = declaration.kind === "text" && (propName === "code" || propName === "text" || propName === "caption");

    return long ?
            <Textarea
                value={String(value ?? "")}
                onChange={event => onChange(event.target.value)}
                aria-label={declaration.label}
                rows={3}
            />
        :   <Input
                value={String(value ?? "")}
                onChange={event => onChange(event.target.value)}
                aria-label={declaration.label}
            />;
}

function SortableBlockCard({
    block,
    index,
    total,
    onMove,
    onRemove,
    title,
    fields
}: {
    block: BlockInstance;
    index: number;
    total: number;
    onMove: (direction: -1 | 1) => void;
    onRemove: () => void;
    title: React.ReactNode;
    fields: React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`bg-card rounded-2xl border p-4 ${isDragging ? "shadow-lifted z-10 opacity-90" : ""}`}
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="text-muted-foreground hover:text-foreground cursor-grab rounded-md p-1 transition-colors active:cursor-grabbing"
                    aria-label={`Drag block ${index + 1}`}
                >
                    <GripVertical className="size-4" />
                </button>
                {title}
                <div className="ml-auto flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={index === 0}>
                        <ArrowUp className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onMove(1)}
                        disabled={index === total - 1}
                    >
                        <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>
            {fields}
        </div>
    );
}

export function PageEditor({
    action,
    initial,
    submitLabel
}: {
    action: (state: PageFormState, formData: FormData) => Promise<PageFormState>;
    initial: { id?: string; title: string; address: string; status: string; blocks: BlockInstance[] };
    submitLabel: string;
}) {
    const [state, formAction, pending] = useActionState<PageFormState, FormData>(action, {});
    const [title, setTitle] = useState(initial.title);
    const [address, setAddress] = useState(initial.address);
    const [status, setStatus] = useState(initial.status);
    const [blocks, setBlocks] = useState<BlockInstance[]>(initial.blocks);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    function patchBlock(id: string, propName: string, value: unknown) {
        setBlocks(current =>
            current.map(block => (block.id === id ? { ...block, props: { ...block.props, [propName]: value } } : block))
        );
    }

    function move(index: number, direction: -1 | 1) {
        setBlocks(current => {
            const target = index + direction;

            if (target < 0 || target >= current.length) {
                return current;
            }

            return arrayMove(current, index, target);
        });
    }

    function remove(id: string) {
        setBlocks(current => current.filter(block => block.id !== id));
    }

    function add(type: string) {
        setBlocks(current => [...current, newBlock(type)]);
    }

    function onDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over === null || active.id === over.id) {
            return;
        }

        setBlocks(current => {
            const from = current.findIndex(block => block.id === active.id);
            const to = current.findIndex(block => block.id === over.id);

            return from < 0 || to < 0 ? current : arrayMove(current, from, to);
        });
    }

    return (
        <form action={formAction} className="space-y-8">
            {initial.id ?
                <input type="hidden" name="id" value={initial.id} />
            :   null}
            <input type="hidden" name="body" value={JSON.stringify({ version: 1, blocks })} />
            <input type="hidden" name="status" value={status} />

            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="page-title">Title</Label>
                    <Input
                        id="page-title"
                        name="title"
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="page-address">Address</Label>
                    <Input
                        id="page-address"
                        name="address"
                        value={address}
                        onChange={event => setAddress(event.target.value)}
                        className="font-mono"
                    />
                </div>
            </div>

            <div className="max-w-xs">
                <Label>Status</Label>
                <Select
                    value={status}
                    onValueChange={value => {
                        if (value) setStatus(value);
                    }}
                >
                    <SelectTrigger className="mt-2">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label>Blocks</Label>
                {blocks.length === 0 ?
                    <div className="rounded-2xl border border-dashed px-8 py-12 text-center text-sm text-muted-foreground">
                        No blocks yet. Add the first one below.
                    </div>
                :   <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={blocks.map(block => block.id)} strategy={verticalListSortingStrategy}>
                            {blocks.map((block, index) => {
                                const definition = builtinBlocks[block.type as keyof typeof builtinBlocks] as
                                    BlockDefinition | undefined;
                                const propEntries = Object.entries(definition?.props ?? {});

                                return (
                                    <SortableBlockCard
                                        key={block.id}
                                        block={block}
                                        index={index}
                                        total={blocks.length}
                                        onMove={direction => move(index, direction)}
                                        onRemove={() => remove(block.id)}
                                        title={
                                            <span className="text-sm font-medium">
                                                {definition?.label ?? block.type}
                                                <span className="text-muted-foreground ml-2 font-mono text-xs">
                                                    {block.type}
                                                </span>
                                            </span>
                                        }
                                        fields={
                                            propEntries.length > 0 ?
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {propEntries.map(([propName, declaration]) => (
                                                        <div
                                                            key={propName}
                                                            className={
                                                                declaration.kind === "flag" ?
                                                                    "flex items-center"
                                                                :   "space-y-1.5"
                                                            }
                                                        >
                                                            {declaration.kind !== "flag" ?
                                                                <Label className="text-xs">{declaration.label}</Label>
                                                            :   null}
                                                            <PropField
                                                                block={block}
                                                                propName={propName}
                                                                onChange={value =>
                                                                    patchBlock(block.id, propName, value)
                                                                }
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            :   null
                                        }
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                }

                <Select
                    key={`add-block-${blocks.length}`}
                    value={null as string | null}
                    onValueChange={(value: string | null) => {
                        if (value) add(value);
                    }}
                >
                    <SelectTrigger className="w-fit">
                        <span className="inline-flex items-center gap-2">
                            <Plus className="size-4" /> Add a block
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        {INSERTABLE.map(block => (
                            <SelectItem key={block.name} value={block.name}>
                                {block.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : submitLabel}
                </Button>
                {state.error ?
                    <p className="text-destructive text-sm">{state.error}</p>
                :   null}
                {state.saved ?
                    <p className="text-sm">Saved. Published changes are live on the site.</p>
                :   null}
            </div>
        </form>
    );
}

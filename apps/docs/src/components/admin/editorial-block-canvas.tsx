"use client";

import { useRef } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import type { BlockDefinition, BlockDocument, BlockInstance } from "@jamcaaxian/core/content";
import type { RichTextEditorMessages, RichTextMediaAdapter } from "@jamcaaxian/editor";
import {
    BlockPropEditor,
    blockPropInputId,
    useBlockDocumentEditor,
    type BlockChoiceOptions
} from "@jamcaaxian/editor/blocks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export interface EditorialBlockCanvasMessages {
    addBlock: string;
    moveUp: string;
    moveDown: string;
    remove: string;
    empty: string;
    unknown: string;
    dragBlock(index: number): string;
}

function SortableBlock({
    block,
    definition,
    index,
    total,
    editorName,
    messages,
    choices,
    media,
    richTextMessages,
    onMove,
    onPatch,
    onRemove
}: {
    block: BlockInstance;
    definition?: BlockDefinition;
    index: number;
    total: number;
    editorName: string;
    messages: EditorialBlockCanvasMessages;
    choices?: BlockChoiceOptions;
    media?: RichTextMediaAdapter;
    richTextMessages?: Partial<RichTextEditorMessages>;
    onMove(offset: -1 | 1): void;
    onPatch(propName: string, value: unknown): void;
    onRemove(): void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    const props = Object.entries(definition?.props ?? {});
    const richTextOnly = props.length === 1 && props[0]?.[1].kind === "richText";

    return (
        <section
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className="editorial-block group/block"
            data-rich-text-only={richTextOnly || undefined}
            data-dragging={isDragging || undefined}
        >
            <div className="editorial-block__rail">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="editorial-block__drag"
                    aria-label={messages.dragBlock(index + 1)}
                >
                    <GripVertical />
                </button>
                <div className="editorial-block__actions">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMove(-1)}
                        disabled={index === 0}
                        aria-label={messages.moveUp}
                    >
                        <ArrowUp />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMove(1)}
                        disabled={index === total - 1}
                        aria-label={messages.moveDown}
                    >
                        <ArrowDown />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onRemove}
                        aria-label={messages.remove}
                    >
                        <Trash2 />
                    </Button>
                </div>
            </div>

            {definition === undefined ?
                <div className="editorial-block__unknown">
                    <strong>{messages.unknown}</strong>
                    <code>{block.type}</code>
                    <pre>{JSON.stringify(block.props, null, 2)}</pre>
                </div>
            : richTextOnly ?
                <BlockPropEditor
                    editorName={editorName}
                    block={block}
                    propName={props[0]![0]}
                    declaration={props[0]![1]}
                    media={media}
                    richTextMessages={richTextMessages}
                    richTextClassName="jamcaa-rich-text-editor--immersive"
                    onChange={value => onPatch(props[0]![0], value)}
                />
            :   <div className="editorial-block__panel">
                    <div className="editorial-block__heading">
                        <div>
                            <h3>{definition.label}</h3>
                            {definition.description ?
                                <p>{definition.description}</p>
                            :   null}
                        </div>
                        <code>{block.type}</code>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        {props.map(([propName, declaration]) => (
                            <div key={propName} className="grid gap-2">
                                {declaration.kind === "flag" ?
                                    <label className="flex min-h-11 items-center gap-3 text-sm">
                                        <BlockPropEditor
                                            editorName={editorName}
                                            block={block}
                                            propName={propName}
                                            declaration={declaration}
                                            media={media}
                                            richTextMessages={richTextMessages}
                                            onChange={value => onPatch(propName, value)}
                                        />
                                        <span>{declaration.label}</span>
                                    </label>
                                :   <>
                                        <Label htmlFor={blockPropInputId(editorName, block.id, propName)}>
                                            {declaration.label}
                                        </Label>
                                        <BlockPropEditor
                                            editorName={editorName}
                                            block={block}
                                            propName={propName}
                                            declaration={declaration}
                                            media={media}
                                            richTextMessages={richTextMessages}
                                            choiceOptions={choices?.[block.type]?.[propName]}
                                            onChange={value => onPatch(propName, value)}
                                        />
                                    </>
                                }
                                {declaration.description ?
                                    <p className="text-muted-foreground text-sm leading-6">{declaration.description}</p>
                                :   null}
                            </div>
                        ))}
                    </div>
                </div>
            }
        </section>
    );
}

export function EditorialBlockCanvas({
    name,
    label,
    defaultValue,
    definitions,
    choices,
    messages,
    media,
    richTextMessages
}: {
    name: string;
    label: string;
    defaultValue: BlockDocument;
    definitions: readonly BlockDefinition[];
    choices?: BlockChoiceOptions;
    messages: EditorialBlockCanvasMessages;
    media?: RichTextMediaAdapter;
    richTextMessages?: Partial<RichTextEditorMessages>;
}) {
    const hiddenInput = useRef<HTMLInputElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const { document, definitionsByName, replaceBlocks, patchBlock, moveBlock, removeBlock, addBlock } =
        useBlockDocumentEditor({
            defaultValue,
            definitions,
            onChange: () => hiddenInput.current?.dispatchEvent(new Event("input", { bubbles: true }))
        });

    function onDragEnd(event: DragEndEvent) {
        if (event.over === null || event.active.id === event.over.id) {
            return;
        }

        const from = document.blocks.findIndex(block => block.id === event.active.id);
        const to = document.blocks.findIndex(block => block.id === event.over?.id);

        if (from >= 0 && to >= 0) {
            replaceBlocks(arrayMove(document.blocks, from, to));
        }
    }

    return (
        <div className="editorial-block-canvas" aria-label={label}>
            <input ref={hiddenInput} type="hidden" name={name} value={JSON.stringify(document)} />
            {document.blocks.length === 0 ?
                <div className="editorial-block-canvas__empty">{messages.empty}</div>
            :   <DndContext
                    id={`${name}-block-canvas`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={document.blocks.map(block => block.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {document.blocks.map((block, index) => (
                            <SortableBlock
                                key={block.id}
                                block={block}
                                definition={definitionsByName.get(block.type)}
                                index={index}
                                total={document.blocks.length}
                                editorName={name}
                                messages={messages}
                                choices={choices}
                                media={media}
                                richTextMessages={richTextMessages}
                                onMove={offset => moveBlock(index, offset)}
                                onPatch={(propName, value) => patchBlock(block.id, propName, value)}
                                onRemove={() => removeBlock(block.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            }

            <Select
                key={`add-block-${document.blocks.length}`}
                value={null as string | null}
                onValueChange={value => {
                    if (value !== null) {
                        addBlock(value);
                    }
                }}
            >
                <SelectTrigger className="editorial-block-canvas__add">
                    <span className="inline-flex items-center gap-2">
                        <Plus />
                        {messages.addBlock}
                    </span>
                </SelectTrigger>
                <SelectContent>
                    {definitions.map(definition => (
                        <SelectItem key={definition.name} value={definition.name}>
                            {definition.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

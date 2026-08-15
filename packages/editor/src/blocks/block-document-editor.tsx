"use client";

import { useMemo, useState } from "react";
import {
    emptyRichText,
    type BlockDefinition,
    type BlockDocument,
    type BlockInstance,
    type BlockPropDeclaration,
    type RichTextDocument
} from "@jamcaaxian/core/content";
import type { RichTextMediaAdapter } from "../media";
import type { RichTextEditorMessages } from "../messages";
import { RichTextEditor } from "../rich-text-editor";

export interface BlockDocumentEditorMessages {
    addBlock: string;
    moveUp: string;
    moveDown: string;
    remove: string;
    empty: string;
    unknown: string;
}

const defaultMessages: BlockDocumentEditorMessages = {
    addBlock: "Add a block",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    empty: "No blocks yet.",
    unknown: "Unknown Block"
};

function initialProps(definition: BlockDefinition): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    for (const [name, declaration] of Object.entries(definition.props)) {
        if (declaration.default !== undefined) {
            props[name] = declaration.default;
        } else if (declaration.kind === "richText") {
            props[name] = emptyRichText();
        } else if (declaration.kind === "choice") {
            props[name] = declaration.choices?.[0];
        }
    }

    return props;
}

function createBlock(definition: BlockDefinition): BlockInstance {
    return { id: crypto.randomUUID(), type: definition.name, props: initialProps(definition) };
}

function textAreaAttribute(name: string, declaration: BlockPropDeclaration): boolean {
    return declaration.kind === "text" && ["body", "caption", "code", "description", "detail", "text"].includes(name);
}

function BlockPropField({
    editorName,
    block,
    name,
    declaration,
    media,
    richTextMessages,
    onChange
}: {
    editorName: string;
    block: BlockInstance;
    name: string;
    declaration: BlockPropDeclaration;
    media?: RichTextMediaAdapter;
    richTextMessages?: Partial<RichTextEditorMessages>;
    onChange(value: unknown): void;
}) {
    const value = block.props[name];
    const inputId = `${editorName}-${block.id}-${name}`;

    if (declaration.kind === "richText") {
        return (
            <RichTextEditor
                name={`${editorName}--${block.id}--${name}`}
                label={declaration.label}
                defaultValue={value as RichTextDocument | undefined}
                media={media}
                messages={richTextMessages}
                onChange={onChange}
            />
        );
    }

    if (declaration.kind === "flag") {
        return (
            <input
                id={inputId}
                type="checkbox"
                checked={Boolean(value)}
                onChange={event => onChange(event.currentTarget.checked)}
            />
        );
    }

    if (declaration.kind === "choice") {
        return (
            <select
                id={inputId}
                className="jamcaa-editing-control"
                value={String(value ?? "")}
                onChange={event => onChange(event.currentTarget.value)}
            >
                {declaration.choices?.map(choice => (
                    <option key={choice} value={choice}>
                        {choice}
                    </option>
                ))}
            </select>
        );
    }

    if (textAreaAttribute(name, declaration)) {
        return (
            <textarea
                id={inputId}
                className="jamcaa-editing-control jamcaa-editing-control--multiline"
                value={String(value ?? "")}
                rows={name === "code" ? 10 : 4}
                onChange={event => onChange(event.currentTarget.value)}
            />
        );
    }

    return (
        <input
            id={inputId}
            className="jamcaa-editing-control"
            type={
                declaration.kind === "number" ? "number"
                : declaration.kind === "color" ?
                    "color"
                :   "text"
            }
            value={String(value ?? "")}
            onChange={event =>
                onChange(declaration.kind === "number" ? Number(event.currentTarget.value) : event.currentTarget.value)
            }
        />
    );
}

export interface BlockDocumentEditorProps {
    name: string;
    label: string;
    defaultValue?: BlockDocument;
    definitions: readonly BlockDefinition[];
    media?: RichTextMediaAdapter;
    richTextMessages?: Partial<RichTextEditorMessages>;
    messages?: Partial<BlockDocumentEditorMessages>;
    onChange?: (document: BlockDocument) => void;
}

export function BlockDocumentEditor({
    name,
    label,
    defaultValue,
    definitions,
    media,
    richTextMessages,
    messages,
    onChange
}: BlockDocumentEditorProps) {
    const copy = { ...defaultMessages, ...messages };
    const definitionsByName = useMemo(
        () => new Map(definitions.map(definition => [definition.name, definition])),
        [definitions]
    );
    const [document, setDocument] = useState<BlockDocument>(defaultValue ?? { version: 1, blocks: [] });

    function update(blocks: BlockInstance[]) {
        const next: BlockDocument = { version: 1, blocks };
        setDocument(next);
        onChange?.(next);
    }

    function patch(id: string, prop: string, value: unknown) {
        update(
            document.blocks.map(block =>
                block.id === id ? { ...block, props: { ...block.props, [prop]: value } } : block
            )
        );
    }

    function move(index: number, offset: -1 | 1) {
        const target = index + offset;

        if (target < 0 || target >= document.blocks.length) {
            return;
        }

        const blocks = [...document.blocks];
        const [block] = blocks.splice(index, 1);

        if (block !== undefined) {
            blocks.splice(target, 0, block);
            update(blocks);
        }
    }

    return (
        <div className="jamcaa-block-editor" id={`${name}-editor`} aria-label={label}>
            <input type="hidden" name={name} value={JSON.stringify(document)} />
            <div className="jamcaa-block-editor__canvas">
                {document.blocks.length === 0 ?
                    <p className="jamcaa-block-editor__empty">{copy.empty}</p>
                :   document.blocks.map((block, index) => {
                        const definition = definitionsByName.get(block.type);

                        return (
                            <section className="jamcaa-block-editor__block" key={block.id}>
                                <header className="jamcaa-block-editor__block-header">
                                    <div>
                                        <strong>{definition?.label ?? copy.unknown}</strong>
                                        <code>{block.type}</code>
                                    </div>
                                    <div className="jamcaa-block-editor__actions">
                                        <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
                                            {copy.moveUp}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(index, 1)}
                                            disabled={index === document.blocks.length - 1}
                                        >
                                            {copy.moveDown}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => update(document.blocks.filter(item => item.id !== block.id))}
                                        >
                                            {copy.remove}
                                        </button>
                                    </div>
                                </header>
                                {definition === undefined ?
                                    <pre className="jamcaa-block-editor__unknown-value">
                                        {JSON.stringify(block.props, null, 2)}
                                    </pre>
                                :   <div className="jamcaa-block-editor__fields">
                                        {Object.entries(definition.props).map(([propName, declaration]) => (
                                            <div className="jamcaa-editing-field" key={propName}>
                                                <label
                                                    className="jamcaa-editing-field__label"
                                                    htmlFor={`${name}-${block.id}-${propName}`}
                                                >
                                                    {declaration.label}
                                                </label>
                                                <BlockPropField
                                                    editorName={name}
                                                    block={block}
                                                    name={propName}
                                                    declaration={declaration}
                                                    media={media}
                                                    richTextMessages={richTextMessages}
                                                    onChange={value => patch(block.id, propName, value)}
                                                />
                                                {declaration.description ?
                                                    <p className="jamcaa-editing-field__description">
                                                        {declaration.description}
                                                    </p>
                                                :   null}
                                            </div>
                                        ))}
                                    </div>
                                }
                            </section>
                        );
                    })
                }
            </div>
            <label className="jamcaa-block-editor__add">
                <span>{copy.addBlock}</span>
                <select
                    className="jamcaa-editing-control"
                    value=""
                    onChange={event => {
                        const definition = definitionsByName.get(event.currentTarget.value);

                        if (definition !== undefined) {
                            update([...document.blocks, createBlock(definition)]);
                        }
                    }}
                >
                    <option value="">{copy.addBlock}</option>
                    {definitions.map(definition => (
                        <option key={definition.name} value={definition.name}>
                            {definition.label}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}

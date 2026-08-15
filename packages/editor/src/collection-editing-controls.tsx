"use client";

import { useState, type ReactNode } from "react";
import type { BlockDefinition, BlockDocument, EditingField, RichTextDocument } from "@jamcaaxian/core/content";
import { BlockDocumentEditor, type BlockDocumentEditorMessages } from "./blocks/block-document-editor";
import {
    defaultCollectionEditingControlMessages,
    type CollectionEditingControlMessages,
    type RichTextEditorMessages
} from "./messages";
import type { RichTextMediaAdapter } from "./media";
import { RichTextEditor } from "./rich-text-editor";

export type EditingControlValue =
    string | number | boolean | Date | RichTextDocument | BlockDocument | null | undefined;

export interface EditingControlOption {
    value: string;
    label: string;
}

export interface CollectionEditingControlsProps {
    fields: readonly EditingField[];
    values?: Readonly<Record<string, EditingControlValue>>;
    choices?: Readonly<Record<string, readonly EditingControlOption[]>>;
    references?: Readonly<Record<string, readonly EditingControlOption[]>>;
    richText?: { media?: RichTextMediaAdapter; messages?: Partial<RichTextEditorMessages> };
    blocks?: {
        definitions: readonly BlockDefinition[];
        media?: RichTextMediaAdapter;
        messages?: Partial<BlockDocumentEditorMessages>;
        richTextMessages?: Partial<RichTextEditorMessages>;
    };
    messages?: Partial<CollectionEditingControlMessages>;
    registry?: EditingControlRegistry;
    onTextChange?(name: string, value: string): void;
}

/** Everything one Editing Control needs to render one declared Field. */
export interface EditingControlContext {
    field: EditingField;
    value: EditingControlValue;
    messages: CollectionEditingControlMessages;
    choices?: CollectionEditingControlsProps["choices"];
    references?: CollectionEditingControlsProps["references"];
    richText?: CollectionEditingControlsProps["richText"];
    blocks?: CollectionEditingControlsProps["blocks"];
    onTextChange?: CollectionEditingControlsProps["onTextChange"];
}

export interface EditingControlDefinition {
    /** Matches the Field kind the control renders. */
    id: string;
    /** Editing protocol versions this control understands. */
    versions: readonly number[];
    render(context: EditingControlContext): ReactNode;
}

export interface EditingControlRegistry {
    control(field: EditingField): EditingControlDefinition;
}

const EDITING_PROTOCOL_VERSION = 1;

/** One place where an input's name comes from, instead of per-control literals. */
export function editingInputName(fieldName: string, part?: string): string {
    return part === undefined ? fieldName : `${fieldName}--${part}`;
}

/**
 * Resolves a Field kind to its control. Duplicate registrations fail at
 * assembly; unknown kinds and unsupported protocol versions fail at render.
 */
export function createEditingControlRegistry(controls: readonly EditingControlDefinition[]): EditingControlRegistry {
    const byId = new Map<string, EditingControlDefinition>();

    for (const control of controls) {
        if (byId.has(control.id)) {
            throw new Error(`Editing Control "${control.id}" is registered twice.`);
        }

        byId.set(control.id, control);
    }

    return {
        control(field) {
            const dispatchKind = field.editingKind ?? field.kind;
            const definition = byId.get(dispatchKind);

            if (definition === undefined) {
                throw new Error(`No Editing Control is registered for kind "${dispatchKind}".`);
            }

            if (!definition.versions.includes(EDITING_PROTOCOL_VERSION)) {
                throw new Error(
                    `Editing Control "${dispatchKind}" does not support protocol version ${EDITING_PROTOCOL_VERSION}.`
                );
            }

            return definition;
        }
    };
}

function stringValue(value: EditingControlValue): string {
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function commonInputProps(field: EditingField): {
    "id": string;
    "required": boolean;
    "aria-describedby": string | undefined;
} {
    return {
        "id": field.name,
        "required": field.required,
        "aria-describedby": field.description ? `${field.name}-description` : undefined
    };
}

function TextControl({ context }: { context: EditingControlContext }) {
    const { field, value, onTextChange } = context;

    return (
        <input
            {...commonInputProps(field)}
            className="jamcaa-editing-control"
            name={editingInputName(field.name)}
            defaultValue={stringValue(value)}
            onChange={event => onTextChange?.(field.name, event.currentTarget.value)}
        />
    );
}

function MarkdownControl({ context }: { context: EditingControlContext }) {
    const { field, value } = context;

    return (
        <textarea
            {...commonInputProps(field)}
            className="jamcaa-editing-control jamcaa-editing-control--multiline"
            name={editingInputName(field.name)}
            defaultValue={stringValue(value)}
            rows={8}
        />
    );
}

function NumberControl({ context }: { context: EditingControlContext }) {
    const { field, value } = context;

    return (
        <input
            {...commonInputProps(field)}
            className="jamcaa-editing-control"
            type="number"
            name={editingInputName(field.name)}
            defaultValue={stringValue(value)}
            step={field.whole ? 1 : "any"}
        />
    );
}

function ToggleControl({ context }: { context: EditingControlContext }) {
    const { field, value, messages } = context;
    const [toggle, setToggle] = useState(
        value === true ? "true"
        : value === false ? "false"
        : ""
    );

    return (
        <select
            {...commonInputProps(field)}
            className="jamcaa-editing-control"
            name={editingInputName(field.name)}
            value={toggle}
            onChange={event => setToggle(event.currentTarget.value)}
        >
            {!field.required ?
                <option value="">{messages.toggleUnset}</option>
            :   null}
            <option value="true">{messages.toggleYes}</option>
            <option value="false">{messages.toggleNo}</option>
        </select>
    );
}

function MomentControl({ context }: { context: EditingControlContext }) {
    const { field, value } = context;
    const initialMoment = momentInputValue(value);
    const [moment, setMoment] = useState(initialMoment);
    const [momentIso, setMomentIso] = useState(() => momentSubmissionValue(initialMoment));

    return (
        <>
            <input type="hidden" name={editingInputName(field.name)} value={momentIso} />
            <input
                {...commonInputProps(field)}
                className="jamcaa-editing-control"
                type="datetime-local"
                value={moment}
                onChange={event => {
                    const next = event.currentTarget.value;
                    setMoment(next);
                    setMomentIso(momentSubmissionValue(next));
                }}
            />
        </>
    );
}

function ChoiceControl({ context }: { context: EditingControlContext }) {
    const { field, value, choices, messages } = context;
    const labels = new Map(
        field.choices !== undefined ? choices?.[field.name]?.map(option => [option.value, option.label]) : []
    );

    return (
        <select
            {...commonInputProps(field)}
            className="jamcaa-editing-control"
            name={editingInputName(field.name)}
            defaultValue={stringValue(value)}
        >
            {!field.required ?
                <option value="">{messages.none}</option>
            :   null}
            {field.choices !== undefined ?
                field.choices.map(choice => (
                    <option key={choice} value={choice}>
                        {labels.get(choice) ?? choice}
                    </option>
                ))
            :   null}
        </select>
    );
}

function ReferenceControl({ context }: { context: EditingControlContext }) {
    const { field, value, references, messages } = context;
    const options = field.collection !== undefined ? (references?.[field.collection] ?? []) : [];

    return (
        <select
            {...commonInputProps(field)}
            className="jamcaa-editing-control"
            name={editingInputName(field.name)}
            defaultValue={stringValue(value)}
        >
            {!field.required ?
                <option value="">{messages.none}</option>
            :   null}
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function RichTextControl({ context }: { context: EditingControlContext }) {
    const { field, value, richText } = context;

    return (
        <RichTextEditor
            name={editingInputName(field.name)}
            label={field.label}
            labelledBy={`${field.name}-label`}
            defaultValue={value as RichTextDocument | undefined}
            media={richText?.media}
            messages={richText?.messages}
        />
    );
}

function BlocksControl({ context }: { context: EditingControlContext }) {
    const { field, value, blocks } = context;

    if (blocks === undefined) {
        throw new Error(`The blocks Editing Control for "${field.name}" needs Block definitions.`);
    }

    return (
        <BlockDocumentEditor
            name={editingInputName(field.name)}
            label={field.label}
            defaultValue={value as BlockDocument | undefined}
            definitions={blocks.definitions}
            media={blocks.media}
            messages={blocks.messages}
            richTextMessages={blocks.richTextMessages}
        />
    );
}

/** The controls every built-in Field kind resolves to. */
export const builtInEditingControls: readonly EditingControlDefinition[] = [
    { id: "text", versions: [EDITING_PROTOCOL_VERSION], render: context => <TextControl context={context} /> },
    { id: "markdown", versions: [EDITING_PROTOCOL_VERSION], render: context => <MarkdownControl context={context} /> },
    { id: "number", versions: [EDITING_PROTOCOL_VERSION], render: context => <NumberControl context={context} /> },
    { id: "toggle", versions: [EDITING_PROTOCOL_VERSION], render: context => <ToggleControl context={context} /> },
    { id: "moment", versions: [EDITING_PROTOCOL_VERSION], render: context => <MomentControl context={context} /> },
    { id: "choice", versions: [EDITING_PROTOCOL_VERSION], render: context => <ChoiceControl context={context} /> },
    {
        id: "reference",
        versions: [EDITING_PROTOCOL_VERSION],
        render: context => <ReferenceControl context={context} />
    },
    { id: "richText", versions: [EDITING_PROTOCOL_VERSION], render: context => <RichTextControl context={context} /> },
    { id: "blocks", versions: [EDITING_PROTOCOL_VERSION], render: context => <BlocksControl context={context} /> }
];

const defaultEditingControlRegistry = createEditingControlRegistry(builtInEditingControls);

export function momentInputValue(value: EditingControlValue): string {
    const date =
        value instanceof Date ? value
        : typeof value === "string" && value ? new Date(value)
        : undefined;

    if (date === undefined || Number.isNaN(date.getTime())) {
        return "";
    }

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

    return local.toISOString().slice(0, 16);
}

export function momentSubmissionValue(value: string): string {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function CollectionEditingControls({
    fields,
    values = {},
    choices,
    references,
    richText,
    blocks,
    messages,
    registry = defaultEditingControlRegistry,
    onTextChange
}: CollectionEditingControlsProps) {
    const copy = { ...defaultCollectionEditingControlMessages, ...messages };

    return fields.map(field => {
        const descriptionId = `${field.name}-description`;
        const definition = registry.control(field);

        return (
            <div className="jamcaa-editing-field" key={field.name}>
                <label
                    className="jamcaa-editing-field__label"
                    id={`${field.name}-label`}
                    htmlFor={
                        ["richText", "blocks"].includes(field.editingKind ?? field.kind) ?
                            `${field.name}-editor`
                        :   field.name
                    }
                >
                    {field.label}
                </label>
                {definition.render({
                    field,
                    value: values[field.name],
                    messages: copy,
                    choices,
                    references,
                    richText,
                    blocks,
                    onTextChange
                })}
                {field.description ?
                    <p className="jamcaa-editing-field__description" id={descriptionId}>
                        {field.description}
                    </p>
                :   null}
            </div>
        );
    });
}

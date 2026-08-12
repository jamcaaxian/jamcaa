"use client";

import { useState } from "react";
import type { EditingField, RichTextDocument } from "@jamcaa/core/content";
import {
    defaultCollectionEditingControlMessages,
    type CollectionEditingControlMessages,
    type RichTextEditorMessages
} from "./messages";
import type { RichTextMediaAdapter } from "./media";
import { RichTextEditor } from "./rich-text-editor";

export type EditingControlValue = string | number | boolean | Date | RichTextDocument | null | undefined;

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
    messages?: Partial<CollectionEditingControlMessages>;
    onTextChange?(name: string, value: string): void;
}

function stringValue(value: EditingControlValue): string {
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

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

function ScalarControl({
    field,
    value,
    choices,
    references,
    messages,
    onTextChange
}: {
    field: Exclude<EditingField, { kind: "richText" }>;
    value: EditingControlValue;
    choices: CollectionEditingControlsProps["choices"];
    references: CollectionEditingControlsProps["references"];
    messages: CollectionEditingControlMessages;
    onTextChange: CollectionEditingControlsProps["onTextChange"];
}) {
    const [toggle, setToggle] = useState(
        value === true ? "true"
        : value === false ? "false"
        : ""
    );
    const initialMoment = momentInputValue(value);
    const [moment, setMoment] = useState(initialMoment);
    const [momentIso, setMomentIso] = useState(() => momentSubmissionValue(initialMoment));
    const common = {
        "id": field.name,
        "required": field.required,
        "aria-describedby": field.description ? `${field.name}-description` : undefined
    };

    switch (field.kind) {
        case "text":
            return (
                <input
                    {...common}
                    className="jamcaa-editing-control"
                    name={field.name}
                    defaultValue={stringValue(value)}
                    onChange={event => onTextChange?.(field.name, event.currentTarget.value)}
                />
            );
        case "markdown":
            return (
                <textarea
                    {...common}
                    className="jamcaa-editing-control jamcaa-editing-control--multiline"
                    name={field.name}
                    defaultValue={stringValue(value)}
                    rows={8}
                />
            );
        case "number":
            return (
                <input
                    {...common}
                    className="jamcaa-editing-control"
                    type="number"
                    name={field.name}
                    defaultValue={stringValue(value)}
                    step={field.whole ? 1 : "any"}
                />
            );
        case "toggle":
            return (
                <select
                    {...common}
                    className="jamcaa-editing-control"
                    name={field.name}
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
        case "moment":
            return (
                <>
                    <input type="hidden" name={field.name} value={momentIso} />
                    <input
                        {...common}
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
        case "choice": {
            const labels = new Map(choices?.[field.name]?.map(option => [option.value, option.label]));

            return (
                <select
                    {...common}
                    className="jamcaa-editing-control"
                    name={field.name}
                    defaultValue={stringValue(value)}
                >
                    {!field.required ?
                        <option value="">{messages.none}</option>
                    :   null}
                    {field.choices.map(choice => (
                        <option key={choice} value={choice}>
                            {labels.get(choice) ?? choice}
                        </option>
                    ))}
                </select>
            );
        }
        case "reference": {
            const options = references?.[field.collection] ?? [];

            return (
                <select
                    {...common}
                    className="jamcaa-editing-control"
                    name={field.name}
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
    }
}

export function CollectionEditingControls({
    fields,
    values = {},
    choices,
    references,
    richText,
    messages,
    onTextChange
}: CollectionEditingControlsProps) {
    const copy = { ...defaultCollectionEditingControlMessages, ...messages };

    return fields.map(field => {
        const descriptionId = `${field.name}-description`;

        return (
            <div className="jamcaa-editing-field" key={field.name}>
                <label
                    className="jamcaa-editing-field__label"
                    id={`${field.name}-label`}
                    htmlFor={field.kind === "richText" ? `${field.name}-editor` : field.name}
                >
                    {field.label}
                </label>
                {field.kind === "richText" ?
                    <RichTextEditor
                        name={field.name}
                        label={field.label}
                        labelledBy={`${field.name}-label`}
                        defaultValue={values[field.name] as RichTextDocument | undefined}
                        media={richText?.media}
                        messages={richText?.messages}
                    />
                :   <ScalarControl
                        field={field}
                        value={values[field.name]}
                        choices={choices}
                        references={references}
                        messages={copy}
                        onTextChange={onTextChange}
                    />
                }
                {field.description ?
                    <p className="jamcaa-editing-field__description" id={descriptionId}>
                        {field.description}
                    </p>
                :   null}
            </div>
        );
    });
}

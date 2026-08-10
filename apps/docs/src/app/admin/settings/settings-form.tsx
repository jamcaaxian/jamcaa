"use client";

import { useActionState, useState } from "react";
import { buildPermalink, checkPermalink } from "@jamcaa/core/content";
import { checkPattern, describePattern } from "@jamcaa/core/dates";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings, type SettingsFormState } from "./actions";

export interface SettingField {
    key: string;
    kind: "text" | "flag" | "number" | "choice";
    label: string;
    description?: string;
    multiline?: boolean;
    preview?: "moment" | "address";
    suggestions?: readonly string[];
    of?: readonly string[];
    value: string | boolean | number;
}

const SAMPLE_ENTRY = { slug: "hello-world", publishedAt: new Date(Date.UTC(2026, 7, 9)) };

const GROUP_LABELS: Record<string, string> = { site: "Site", format: "Dates and times", permalink: "Addresses" };

function groupOf(key: string) {
    return key.split(".")[0] ?? "other";
}

function objectionTo(field: SettingField, value: string) {
    if (field.preview === "moment") {
        return checkPattern(value);
    }

    if (field.preview === "address") {
        return checkPermalink(value);
    }

    return undefined;
}

function exampleFor(field: SettingField, value: string) {
    if (field.preview === "moment") {
        return describePattern(value);
    }

    if (field.preview === "address") {
        return buildPermalink(value, { ...SAMPLE_ENTRY, collection: field.key.split(".")[1] ?? "post" });
    }

    return undefined;
}

function TextSetting({ field }: { field: SettingField }) {
    const [value, setValue] = useState(String(field.value));
    // Checked before it is shown, so a bad pattern explains itself here rather than
    // silently dropping the example and waiting for the save to object.
    const problem = objectionTo(field, value);
    const example = problem === undefined ? exampleFor(field, value) : undefined;

    return (
        <Field>
            <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
            {field.multiline ?
                <Textarea id={field.key} name={field.key} defaultValue={value} rows={3} />
            :   <Input id={field.key} name={field.key} value={value} onChange={e => setValue(e.target.value)} />}

            {field.suggestions ?
                <div className="flex flex-wrap gap-1.5">
                    {field.suggestions.map(suggestion => (
                        <button
                            key={suggestion}
                            type="button"
                            onClick={() => setValue(suggestion)}
                            className="bg-muted hover:bg-accent pointer-coarse:min-h-11 rounded-md px-2 py-1 font-mono text-xs wrap-anywhere"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            :   null}

            {problem !== undefined ?
                <FieldError errors={[{ message: problem }]} />
            : example !== undefined ?
                <FieldDescription>
                    Shows as <span className="text-foreground font-medium">{example}</span>
                </FieldDescription>
            : field.description ?
                <FieldDescription>{field.description}</FieldDescription>
            :   null}
        </Field>
    );
}

function SettingControl({ field }: { field: SettingField }) {
    if (field.kind === "flag") {
        return (
            <Field orientation="horizontal">
                <input
                    id={field.key}
                    name={field.key}
                    type="checkbox"
                    defaultChecked={Boolean(field.value)}
                    className="accent-primary size-5"
                />
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
            </Field>
        );
    }

    if (field.kind === "number") {
        return (
            <Field>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <Input
                    id={field.key}
                    name={field.key}
                    type="number"
                    defaultValue={Number(field.value)}
                    className="w-full sm:w-40"
                />
                {field.description ?
                    <FieldDescription>{field.description}</FieldDescription>
                :   null}
            </Field>
        );
    }

    if (field.kind === "choice") {
        const options = (field.of ?? []).map(option => ({ value: option, label: option }));

        return (
            <Field>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <Select name={field.key} defaultValue={String(field.value)} items={options}>
                    <SelectTrigger id={field.key} className="w-full sm:w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
        );
    }

    return <TextSetting field={field} />;
}

export function SettingsForm({ fields, mayManage }: { fields: SettingField[]; mayManage: boolean }) {
    const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveSettings, {});

    const groups = [...new Set(fields.map(field => groupOf(field.key)))];

    return (
        <form action={action} className="max-w-3xl space-y-8">
            {groups.map(group => (
                <section key={group} className="space-y-4">
                    <h2 className="text-sm font-semibold tracking-tight">{GROUP_LABELS[group] ?? group}</h2>
                    <FieldGroup>
                        {fields
                            .filter(field => groupOf(field.key) === group)
                            .map(field => (
                                <SettingControl key={field.key} field={field} />
                            ))}
                    </FieldGroup>
                </section>
            ))}

            {state.error ?
                <FieldError errors={[{ message: state.error }]} />
            :   null}
            {state.saved ?
                <p className="text-muted-foreground text-sm">Saved.</p>
            :   null}

            <Button type="submit" disabled={pending || !mayManage} className="w-full sm:w-auto">
                {pending ? "Saving…" : "Save settings"}
            </Button>
        </form>
    );
}

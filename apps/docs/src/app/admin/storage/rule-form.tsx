"use client";

import { useActionState } from "react";
import type { ManagedBucket, ManagedStorageRule, StorageConditions } from "@jamcaaxian/core/media";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetClose, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createRule, saveRule, type StorageFormState } from "./actions";

function joined(values: readonly string[] | undefined) {
    return values?.join(", ") ?? "";
}

function megabytes(bytes: number | undefined) {
    return bytes === undefined ? "" : String(bytes / (1024 * 1024));
}

function datePart(value: string | undefined) {
    return value?.slice(0, 10) ?? "";
}

function ConditionsFields({ conditions = {} }: { conditions?: StorageConditions }) {
    const { copy } = useAdminI18n();

    return (
        <>
            <Field>
                <FieldLabel htmlFor="rule-mime-prefixes">{copy.storage.rules.fileTypes}</FieldLabel>
                <Input
                    id="rule-mime-prefixes"
                    name="mimePrefixes"
                    defaultValue={joined(conditions.mimePrefixes)}
                    placeholder="image/, application/pdf"
                />
                <FieldDescription>{copy.storage.rules.fileTypesDescription}</FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                    <FieldLabel htmlFor="rule-min-size">{copy.storage.rules.minimum}</FieldLabel>
                    <Input
                        id="rule-min-size"
                        name="minMegabytes"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={megabytes(conditions.minSize)}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="rule-max-size">{copy.storage.rules.maximum}</FieldLabel>
                    <Input
                        id="rule-max-size"
                        name="maxMegabytes"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={megabytes(conditions.maxSize)}
                    />
                </Field>
            </div>

            <details className="group rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium select-none">{copy.storage.rules.more}</summary>
                <div className="mt-4 space-y-5">
                    <Field>
                        <FieldLabel htmlFor="rule-collections">{copy.storage.rules.collections}</FieldLabel>
                        <Input
                            id="rule-collections"
                            name="collections"
                            defaultValue={joined(conditions.collections)}
                            placeholder="post, page"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="rule-categories">{copy.storage.rules.categories}</FieldLabel>
                        <Input
                            id="rule-categories"
                            name="categories"
                            defaultValue={joined(conditions.categories)}
                            placeholder="photography, tutorials"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="rule-tags">{copy.storage.rules.tags}</FieldLabel>
                        <Input
                            id="rule-tags"
                            name="tags"
                            defaultValue={joined(conditions.tags)}
                            placeholder="featured, archive"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="rule-author-roles">{copy.storage.rules.authorRoles}</FieldLabel>
                        <Input
                            id="rule-author-roles"
                            name="authorRoles"
                            defaultValue={joined(conditions.authorRoles)}
                            placeholder="admin, editor"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="rule-author-ids">{copy.storage.rules.authorIdsLabel}</FieldLabel>
                        <Textarea
                            id="rule-author-ids"
                            name="authorIds"
                            defaultValue={conditions.authorIds?.join("\n") ?? ""}
                            rows={3}
                            placeholder={copy.storage.rules.authorIdsPlaceholder}
                        />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                            <FieldLabel htmlFor="rule-from">{copy.storage.rules.fromLabel}</FieldLabel>
                            <Input id="rule-from" name="from" type="date" defaultValue={datePart(conditions.from)} />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="rule-until">{copy.storage.rules.untilLabel}</FieldLabel>
                            <Input id="rule-until" name="until" type="date" defaultValue={datePart(conditions.until)} />
                        </Field>
                    </div>
                </div>
            </details>
        </>
    );
}

export function RuleForm({ rule, buckets }: { rule?: ManagedStorageRule; buckets: ManagedBucket[] }) {
    const { copy } = useAdminI18n();
    const isNew = rule === undefined;
    const [state, action, pending] = useActionState<StorageFormState, FormData>(isNew ? createRule : saveRule, {});
    const bucketItems = buckets.map(bucket => ({ value: bucket.id, label: bucket.label }));

    return (
        <form action={action} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {rule ?
                    <input type="hidden" name="id" value={rule.id} />
                :   null}

                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor={`rule-${rule?.id ?? "new"}-label`}>{copy.storage.rules.name}</FieldLabel>
                        <Input
                            id={`rule-${rule?.id ?? "new"}-label`}
                            name="label"
                            defaultValue={rule?.label}
                            placeholder={copy.storage.rules.namePlaceholder}
                            required
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`rule-${rule?.id ?? "new"}-bucket`}>
                            {copy.storage.rules.destinationBucket}
                        </FieldLabel>
                        <Select name="bucketId" defaultValue={rule?.bucketId ?? buckets[0]?.id} items={bucketItems}>
                            <SelectTrigger id={`rule-${rule?.id ?? "new"}-bucket`} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {bucketItems.map(bucket => (
                                    <SelectItem key={bucket.value} value={bucket.value}>
                                        {bucket.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <p className="text-muted-foreground text-sm">{copy.storage.rules.matchDescription}</p>

                    {rule !== undefined && rule.conditions === undefined ?
                        <FieldError errors={[{ message: copy.storage.rules.damagedDescription }]} />
                    :   null}

                    <ConditionsFields conditions={rule?.conditions} />

                    {state.error ?
                        <FieldError errors={[{ message: state.error }]} />
                    : state.saved ?
                        <p className="text-muted-foreground text-sm">{copy.common.saved}</p>
                    :   null}
                </FieldGroup>
            </div>

            <SheetFooter className="border-t">
                <Button type="submit" disabled={pending || buckets.length === 0} className="w-full sm:w-auto">
                    {pending ?
                        copy.common.saving
                    : isNew ?
                        copy.storage.rules.addSubmit
                    :   copy.storage.rules.saveSubmit}
                </Button>
                <SheetClose render={<Button type="button" variant="outline" className="w-full sm:w-auto" />}>
                    {copy.storage.close}
                </SheetClose>
            </SheetFooter>
        </form>
    );
}

"use client";

import { useActionState } from "react";
import type { ManagedBucket } from "@jamcaaxian/core/media";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SheetClose, SheetFooter } from "@/components/ui/sheet";
import { createBucket, saveBucket, type StorageFormState } from "./actions";

export function BucketForm({ bucket }: { bucket?: ManagedBucket }) {
    const { copy } = useAdminI18n();
    const isNew = bucket === undefined;
    const [state, action, pending] = useActionState<StorageFormState, FormData>(isNew ? createBucket : saveBucket, {});

    return (
        <form action={action} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {bucket ?
                    <input type="hidden" name="id" value={bucket.id} />
                :   null}

                <FieldGroup>
                    {isNew ?
                        <Field>
                            <FieldLabel htmlFor="bucket-id">{copy.storage.buckets.id}</FieldLabel>
                            <Input id="bucket-id" name="id" placeholder="archive" required />
                            <FieldDescription>{copy.storage.buckets.idDescription}</FieldDescription>
                        </Field>
                    :   null}

                    <Field>
                        <FieldLabel htmlFor={`bucket-${bucket?.id ?? "new"}-label`}>
                            {copy.storage.buckets.name}
                        </FieldLabel>
                        <Input
                            id={`bucket-${bucket?.id ?? "new"}-label`}
                            name="label"
                            defaultValue={bucket?.label}
                            placeholder={copy.storage.buckets.namePlaceholder}
                            required
                        />
                    </Field>

                    {isNew ?
                        <>
                            <Field>
                                <FieldLabel htmlFor="bucket-binding">{copy.storage.buckets.binding}</FieldLabel>
                                <Input id="bucket-binding" name="binding" placeholder="ARCHIVE_BUCKET" required />
                                <FieldDescription>{copy.storage.buckets.bindingDescription}</FieldDescription>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="bucket-name">{copy.storage.buckets.cloudflareName}</FieldLabel>
                                <Input id="bucket-name" name="bucketName" placeholder="my-site-archive" />
                                <FieldDescription>{copy.storage.buckets.cloudflareDescription}</FieldDescription>
                            </Field>
                        </>
                    :   <Field>
                            <FieldLabel>{copy.storage.buckets.location}</FieldLabel>
                            <div className="bg-muted rounded-lg px-3 py-2 text-sm wrap-anywhere">
                                <span className="font-mono wrap-anywhere">
                                    {bucket.binding ?? bucket.endpoint ?? copy.storage.buckets.notConfigured}
                                </span>
                                {bucket.bucketName ?
                                    <span className="text-muted-foreground"> / {bucket.bucketName}</span>
                                :   null}
                            </div>
                            <FieldDescription>{copy.storage.buckets.locationDescription}</FieldDescription>
                        </Field>
                    }

                    <Field>
                        <FieldLabel htmlFor={`bucket-${bucket?.id ?? "new"}-public-url`}>
                            {copy.storage.buckets.publicAddress}
                        </FieldLabel>
                        <Input
                            id={`bucket-${bucket?.id ?? "new"}-public-url`}
                            name="publicUrl"
                            type="url"
                            defaultValue={bucket?.publicUrl ?? ""}
                            placeholder="https://media.example.com"
                        />
                        <FieldDescription>{copy.storage.buckets.publicDescription}</FieldDescription>
                    </Field>

                    {state.error ?
                        <FieldError errors={[{ message: state.error }]} />
                    : state.saved ?
                        <p className="text-muted-foreground text-sm">{copy.common.saved}</p>
                    :   null}
                </FieldGroup>
            </div>

            <SheetFooter className="border-t">
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending ?
                        copy.common.saving
                    : isNew ?
                        copy.storage.buckets.addSubmit
                    :   copy.storage.buckets.saveSubmit}
                </Button>
                <SheetClose render={<Button type="button" variant="outline" className="w-full sm:w-auto" />}>
                    {copy.storage.close}
                </SheetClose>
            </SheetFooter>
        </form>
    );
}

"use client";

import { useActionState } from "react";
import type { ManagedBucket } from "@jamcaa/core/media";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SheetClose, SheetFooter } from "@/components/ui/sheet";
import { createBucket, saveBucket, type StorageFormState } from "./actions";

export function BucketForm({ bucket }: { bucket?: ManagedBucket }) {
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
                            <FieldLabel htmlFor="bucket-id">Bucket ID</FieldLabel>
                            <Input id="bucket-id" name="id" placeholder="archive" required />
                            <FieldDescription>
                                Stable and lowercase. Media and rules keep this ID, so it cannot be renamed later.
                            </FieldDescription>
                        </Field>
                    :   null}

                    <Field>
                        <FieldLabel htmlFor={`bucket-${bucket?.id ?? "new"}-label`}>Name</FieldLabel>
                        <Input
                            id={`bucket-${bucket?.id ?? "new"}-label`}
                            name="label"
                            defaultValue={bucket?.label}
                            placeholder="Site media"
                            required
                        />
                    </Field>

                    {isNew ?
                        <>
                            <Field>
                                <FieldLabel htmlFor="bucket-binding">R2 binding</FieldLabel>
                                <Input id="bucket-binding" name="binding" placeholder="ARCHIVE_BUCKET" required />
                                <FieldDescription>
                                    The binding must already exist in <code>wrangler.jsonc</code> and this deployment.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="bucket-name">Cloudflare bucket name</FieldLabel>
                                <Input id="bucket-name" name="bucketName" placeholder="my-site-archive" />
                                <FieldDescription>
                                    Required later if the browser will upload directly with a signed address.
                                </FieldDescription>
                            </Field>
                        </>
                    :   <Field>
                            <FieldLabel>Location</FieldLabel>
                            <div className="bg-muted rounded-lg px-3 py-2 text-sm wrap-anywhere">
                                <span className="font-mono wrap-anywhere">
                                    {bucket.binding ?? bucket.endpoint ?? "Not configured"}
                                </span>
                                {bucket.bucketName ?
                                    <span className="text-muted-foreground"> / {bucket.bucketName}</span>
                                :   null}
                            </div>
                            <FieldDescription>
                                Deployment bindings and physical bucket names stay in code so existing media cannot be
                                disconnected accidentally.
                            </FieldDescription>
                        </Field>
                    }

                    <Field>
                        <FieldLabel htmlFor={`bucket-${bucket?.id ?? "new"}-public-url`}>Public address</FieldLabel>
                        <Input
                            id={`bucket-${bucket?.id ?? "new"}-public-url`}
                            name="publicUrl"
                            type="url"
                            defaultValue={bucket?.publicUrl ?? ""}
                            placeholder="https://media.example.com"
                        />
                        <FieldDescription>
                            Optional. Without one, jamcaa securely streams the file through its own media route.
                        </FieldDescription>
                    </Field>

                    {state.error ?
                        <FieldError errors={[{ message: state.error }]} />
                    : state.saved ?
                        <p className="text-muted-foreground text-sm">Saved.</p>
                    :   null}
                </FieldGroup>
            </div>

            <SheetFooter className="border-t">
                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending ?
                        "Saving…"
                    : isNew ?
                        "Add bucket"
                    :   "Save bucket"}
                </Button>
                <SheetClose render={<Button type="button" variant="outline" className="w-full sm:w-auto" />}>
                    Close
                </SheetClose>
            </SheetFooter>
        </form>
    );
}

"use client";

import { useActionState } from "react";
import type { ManagedBucket } from "@jamcaaxian/core/media";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFallback, type StorageFormState } from "./actions";

export function FallbackForm({ buckets, bucketId }: { buckets: ManagedBucket[]; bucketId: string }) {
    const { copy } = useAdminI18n();
    const [state, action, pending] = useActionState<StorageFormState, FormData>(saveFallback, {});
    const items = buckets.map(bucket => ({ value: bucket.id, label: bucket.label }));

    return (
        <form action={action} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Select name="bucketId" defaultValue={bucketId} items={items}>
                    <SelectTrigger aria-label={copy.storage.fallback.select} className="w-full sm:w-64">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {items.map(bucket => (
                            <SelectItem key={bucket.value} value={bucket.value}>
                                {bucket.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-auto">
                    {pending ? copy.common.saving : copy.storage.fallback.set}
                </Button>
            </div>
            {state.error ?
                <FieldError errors={[{ message: state.error }]} />
            : state.saved ?
                <p className="text-muted-foreground text-sm">{copy.common.saved}</p>
            :   null}
        </form>
    );
}

"use client";

import { useActionState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { deleteBucket, deleteRule, type StorageFormState } from "./actions";

export function DeleteStorageButton({
    kind,
    id,
    label,
    disabled,
    reason
}: {
    kind: "bucket" | "rule";
    id: string;
    label: string;
    disabled?: boolean;
    reason?: string;
}) {
    const { copy } = useAdminI18n();
    const [state, action, pending] = useActionState<StorageFormState, FormData>(
        kind === "bucket" ? deleteBucket : deleteRule,
        {}
    );

    if (disabled) {
        return (
            <Button type="button" variant="ghost" size="sm" disabled title={reason}>
                {copy.common.delete}
            </Button>
        );
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                {copy.common.delete}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{copy.storage.delete.title(label)}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {kind === "bucket" ?
                            copy.storage.delete.bucketDescription
                        :   copy.storage.delete.ruleDescription}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {state.error ?
                    <p className="text-destructive text-sm">{state.error}</p>
                :   null}
                <AlertDialogFooter>
                    <AlertDialogCancel>{copy.common.keep}</AlertDialogCancel>
                    <form action={action} className="w-full sm:w-auto">
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" disabled={pending} />}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            {pending ? copy.storage.delete.deleting : copy.common.delete}
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

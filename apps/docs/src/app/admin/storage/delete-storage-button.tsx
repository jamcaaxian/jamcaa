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
    const [state, action, pending] = useActionState<StorageFormState, FormData>(
        kind === "bucket" ? deleteBucket : deleteRule,
        {}
    );

    if (disabled) {
        return (
            <Button type="button" variant="ghost" size="sm" disabled title={reason}>
                Delete
            </Button>
        );
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {kind === "bucket" ?
                            "Only an unused bucket can be removed. Its deployment binding and Cloudflare bucket remain untouched."
                        :   "Future uploads will no longer be routed by this rule. Existing files stay where they are."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {state.error ?
                    <p className="text-destructive text-sm">{state.error}</p>
                :   null}
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <form action={action} className="w-full sm:w-auto">
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" disabled={pending} />}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            {pending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

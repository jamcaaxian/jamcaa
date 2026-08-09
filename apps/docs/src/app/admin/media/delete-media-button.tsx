"use client";

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
import { deleteMedia } from "./actions";

export function DeleteMediaButton({ id, filename }: { id: string; filename: string }) {
    return (
        <AlertDialog>
            <AlertDialogTrigger
                render={
                    <Button variant="ghost" size="sm" className="text-destructive h-auto px-1 py-0 text-xs">
                        Delete
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{filename}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The file goes from storage for good. Anywhere it has been placed in a post will be left pointing
                        at nothing.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <form action={deleteMedia}>
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" />}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            Delete
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

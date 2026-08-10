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
import { deletePost } from "./actions";

export function DeletePostButton({ id, title }: { id: string; title: string }) {
    return (
        <AlertDialog>
            <AlertDialogTrigger
                render={
                    <Button variant="ghost" className="text-destructive">
                        Delete
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The post and everything in it goes for good. To take it out of sight without losing it, archive
                        it instead.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <form action={deletePost} className="w-full sm:w-auto">
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" />}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

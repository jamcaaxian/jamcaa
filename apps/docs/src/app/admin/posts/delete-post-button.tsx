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
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { deletePost } from "./actions";

export function DeletePostButton({ id, title }: { id: string; title: string }) {
    const { copy } = useAdminI18n();

    return (
        <AlertDialog>
            <AlertDialogTrigger
                render={
                    <Button variant="ghost" className="text-destructive">
                        {copy.common.delete}
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{copy.posts.delete.title(title)}</AlertDialogTitle>
                    <AlertDialogDescription>{copy.posts.delete.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{copy.common.keep}</AlertDialogCancel>
                    <form action={deletePost} className="w-full sm:w-auto">
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" />}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {copy.common.delete}
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

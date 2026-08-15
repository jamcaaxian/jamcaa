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
import { deleteMedia } from "./actions";

export function DeleteMediaButton({ id, filename }: { id: string; filename: string }) {
    const { copy } = useAdminI18n();

    return (
        <AlertDialog>
            <AlertDialogTrigger
                render={
                    <Button variant="ghost" size="sm" className="text-destructive -mr-2 text-xs sm:mr-0">
                        {copy.common.delete}
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{copy.media.deleteTitle(filename)}</AlertDialogTitle>
                    <AlertDialogDescription>{copy.media.deleteDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{copy.common.keep}</AlertDialogCancel>
                    <form action={deleteMedia} className="w-full sm:w-auto">
                        <input type="hidden" name="id" value={id} />
                        <AlertDialogAction
                            nativeButton
                            render={<button type="submit" />}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            {copy.common.delete}
                        </AlertDialogAction>
                    </form>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

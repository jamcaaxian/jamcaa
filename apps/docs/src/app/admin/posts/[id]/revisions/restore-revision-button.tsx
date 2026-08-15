"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { restoreRevision, type RestoreRevisionState } from "./actions";

export function RestoreRevisionButton({ entryId, revisionId }: { entryId: string; revisionId: string }) {
    const { copy } = useAdminI18n();
    const [state, action, pending] = useActionState<RestoreRevisionState, FormData>(restoreRevision, {});

    return (
        <form action={action} className="space-y-2">
            <input type="hidden" name="entryId" value={entryId} />
            <input type="hidden" name="revisionId" value={revisionId} />
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending ? copy.posts.revisions.restoring : copy.posts.revisions.restore}
            </Button>
            <div aria-live="polite">
                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}
            </div>
        </form>
    );
}

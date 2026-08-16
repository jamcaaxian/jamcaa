"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BlockInstance } from "@jamcaaxian/core/content";
import { createHttpMediaAdapter } from "@jamcaaxian/editor/media";
import { EditorialBlockCanvas } from "@/components/admin/editorial-block-canvas";
import {
    EditorialSettingsSection,
    EditorialTitleInput,
    EditorialWorkspace
} from "@/components/admin/editorial-workspace";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { localizedSiteBlockChoices, localizedSiteBlocks } from "@/content/admin-content";
import { setAdminCrumb } from "@/lib/admin-crumb";
import type { PageFormState } from "./actions";

const pageMedia = createHttpMediaAdapter();

export function PageEditor({
    action,
    initial,
    mayPublish,
    submitLabel,
    viewHref
}: {
    action: (state: PageFormState, formData: FormData) => Promise<PageFormState>;
    initial: { id?: string; title: string; address: string; status: string; blocks: BlockInstance[] };
    mayPublish: boolean;
    submitLabel: string;
    viewHref?: string;
}) {
    const { locale, copy } = useAdminI18n();
    const [title, setTitle] = useState(initial.title);
    const statuses = [
        { value: "draft", label: copy.common.status.draft },
        ...(mayPublish || initial.status === "published" ?
            [{ value: "published", label: copy.common.status.published }]
        :   [])
    ];
    const canSubmit = mayPublish || initial.status !== "published";

    useEffect(() => {
        setAdminCrumb(title.trim() || copy.pages.form.untitled);
        return () => setAdminCrumb(null);
    }, [copy.pages.form.untitled, title]);

    return (
        <EditorialWorkspace
            action={action}
            formId="page-editor"
            backHref="/admin/pages"
            backLabel={copy.pages.form.back}
            initialStatus={initial.status}
            reviewStatus={mayPublish ? "published" : initial.status}
            statuses={statuses}
            reviewLabel={mayPublish ? copy.pages.form.reviewPublish : copy.pages.form.reviewSave}
            settingsTitle={copy.pages.form.publishSettings}
            settingsDescription={copy.pages.form.publishSettingsDescription}
            statusLabel={copy.pages.form.status}
            statusDescription={copy.pages.form.statusDescription}
            submitLabel={status => (status === "published" ? copy.pages.form.publish : submitLabel)}
            messages={{
                more: copy.pages.form.more,
                settings: copy.pages.form.settings,
                saveDraft: copy.pages.form.saveDraft,
                archive: copy.pages.form.saveDraft,
                cancel: copy.common.cancel,
                saving: copy.common.saving,
                keyboardSave: copy.pages.form.keyboardSave
            }}
            savedMessage={copy.common.saved}
            canSubmit={canSubmit}
            hiddenFields={initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
            moreActions={
                viewHref ?
                    <DropdownMenuItem
                        nativeButton={false}
                        render={<Link href={viewHref} target="_blank" rel="noopener noreferrer" />}
                    >
                        {copy.pages.form.viewOnSite}
                    </DropdownMenuItem>
                :   null
            }
            settings={
                <EditorialSettingsSection
                    title={copy.pages.form.addressSettings}
                    description={copy.pages.form.addressSettingsDescription}
                >
                    <Input
                        id="page-address"
                        name="address"
                        defaultValue={initial.address}
                        className="font-mono"
                        aria-label={copy.pages.form.address}
                    />
                </EditorialSettingsSection>
            }
        >
            <article className="editorial-composer">
                <EditorialTitleInput
                    name="title"
                    value={title}
                    onChange={setTitle}
                    placeholder={copy.pages.form.titlePlaceholder}
                    label={copy.pages.form.title}
                />
                <EditorialBlockCanvas
                    name="body"
                    label={copy.pages.form.blocks}
                    defaultValue={{ version: 1, blocks: initial.blocks }}
                    definitions={localizedSiteBlocks(locale)}
                    choices={localizedSiteBlockChoices(locale)}
                    media={pageMedia}
                    messages={{ ...copy.editor.blocks, dragBlock: copy.pages.form.dragBlock }}
                    richTextMessages={{ ...copy.editor.richText, placeholder: copy.pages.form.bodyPlaceholder }}
                />
            </article>
        </EditorialWorkspace>
    );
}

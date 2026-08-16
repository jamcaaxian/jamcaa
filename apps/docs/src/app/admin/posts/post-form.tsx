"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    emptyRichText,
    type BlockDocument,
    type Category,
    type EditingField,
    type Tag
} from "@jamcaaxian/core/content";
import { CollectionEditingControls, type EditingControlValue } from "@jamcaaxian/editor";
import { createHttpMediaAdapter } from "@jamcaaxian/editor/media";
import { EditorialBlockCanvas } from "@/components/admin/editorial-block-canvas";
import {
    EditorialSettingsSection,
    EditorialTitleInput,
    EditorialWorkspace
} from "@/components/admin/editorial-workspace";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localizedSiteBlockChoices, localizedSiteBlocks } from "@/content/admin-content";
import { setAdminCrumb } from "@/lib/admin-crumb";
import { DeletePostButton } from "./delete-post-button";
import { savePost, type PostFormState } from "./actions";

export interface PostDraft {
    id: string;
    slug: string;
    status: string;
    categoryId: string;
    fields: Readonly<Record<string, EditingControlValue>>;
}

export interface PostAddressSettings {
    pattern: string;
    mayChooseSlug: boolean;
}

const postMedia = createHttpMediaAdapter({ collection: "post" });

function initialPostBody(value: EditingControlValue): BlockDocument {
    if (typeof value === "object" && value !== null && "version" in value && "blocks" in value) {
        return value as BlockDocument;
    }

    return { version: 1, blocks: [{ id: "body", type: "builtin.richText", props: { document: emptyRichText() } }] };
}

export function PostForm({
    post,
    fields,
    titleFieldName,
    mayPublish,
    mayDelete = false,
    address,
    categories,
    tags,
    selectedTagIds
}: {
    post?: PostDraft;
    fields: readonly EditingField[];
    titleFieldName: string;
    mayPublish: boolean;
    mayDelete?: boolean;
    address: PostAddressSettings;
    categories: Category[];
    tags: Tag[];
    selectedTagIds: string[];
}) {
    const { locale, copy } = useAdminI18n();
    const [title, setTitle] = useState(String(post?.fields[titleFieldName] ?? ""));
    const titleField = fields.find(field => field.name === titleFieldName);
    const scalarFields = fields.filter(
        field => field.name !== titleFieldName && field.kind !== "richText" && field.kind !== "blocks"
    );
    const bodyField = fields.find(field => field.kind === "richText" || field.kind === "blocks");
    const fieldValues = post?.fields ?? {};
    const blockDefinitions = localizedSiteBlocks(locale);
    const blockChoices = localizedSiteBlockChoices(locale);
    const statuses = useMemo(
        () => [
            { value: "draft", label: copy.common.status.draft },
            ...(mayPublish || post?.status === "published" ?
                [{ value: "published", label: copy.common.status.published }]
            :   []),
            { value: "archived", label: copy.common.status.archived }
        ],
        [copy.common.status.archived, copy.common.status.draft, copy.common.status.published, mayPublish, post?.status]
    );
    const initialStatus = post?.status ?? "draft";
    const canSubmit = categories.length > 0 && (mayPublish || initialStatus !== "published");

    useEffect(() => {
        setAdminCrumb(title.trim() || copy.posts.form.untitled);
        return () => setAdminCrumb(null);
    }, [copy.posts.form.untitled, title]);

    return (
        <EditorialWorkspace
            action={savePost as (state: PostFormState, formData: FormData) => Promise<PostFormState>}
            formId="post-editor"
            backHref="/admin/posts"
            backLabel={copy.posts.form.back}
            initialStatus={initialStatus}
            reviewStatus={mayPublish ? "published" : initialStatus}
            statuses={statuses}
            reviewLabel={mayPublish ? copy.posts.form.reviewPublish : copy.posts.form.reviewSave}
            settingsTitle={copy.posts.form.publishSettings}
            settingsDescription={copy.posts.form.publishSettingsDescription}
            statusLabel={copy.posts.form.status}
            statusDescription={copy.posts.form.statusDescription}
            submitLabel={status =>
                status === "published" ? copy.posts.form.publish
                : status === "archived" ? copy.posts.form.archive
                : copy.posts.form.saveDraft
            }
            messages={{
                more: copy.posts.form.more,
                settings: copy.posts.form.settings,
                saveDraft: copy.posts.form.saveDraft,
                archive: copy.posts.form.archive,
                cancel: copy.common.cancel,
                saving: copy.common.saving,
                keyboardSave: copy.posts.form.keyboardSave
            }}
            savedMessage={copy.common.saved}
            canSubmit={canSubmit}
            hiddenFields={post ? <input type="hidden" name="id" value={post.id} /> : null}
            moreActions={
                post ?
                    <>
                        <DropdownMenuItem
                            nativeButton={false}
                            render={
                                <Link
                                    href={`/preview/posts/${encodeURIComponent(post.id)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                />
                            }
                        >
                            {copy.posts.form.preview}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            nativeButton={false}
                            render={<Link href={`/admin/posts/${encodeURIComponent(post.id)}/revisions`} />}
                        >
                            {copy.posts.form.revisions}
                        </DropdownMenuItem>
                    </>
                :   null
            }
            dangerZone={post && mayDelete ? <DeletePostButton id={post.id} title={title} /> : undefined}
            settings={
                <>
                    <EditorialSettingsSection
                        title={copy.posts.form.summarySettings}
                        description={copy.posts.form.summarySettingsDescription}
                    >
                        <CollectionEditingControls
                            fields={scalarFields}
                            values={fieldValues}
                            messages={copy.editor.collection}
                        />
                    </EditorialSettingsSection>

                    <EditorialSettingsSection title={copy.posts.form.addressSettings}>
                        {address.mayChooseSlug ?
                            <Field>
                                <FieldLabel htmlFor="slug">{copy.posts.form.slug}</FieldLabel>
                                <Input
                                    id="slug"
                                    name="slug"
                                    defaultValue={post?.slug}
                                    placeholder={copy.posts.form.slugPlaceholder}
                                />
                                <FieldDescription>{copy.posts.form.slugDescription(address.pattern)}</FieldDescription>
                            </Field>
                        :   <>
                                <input type="hidden" name="slug" value={post?.slug ?? ""} />
                                <p className="text-muted-foreground text-sm leading-6">
                                    {copy.posts.form.addressDescription(address.pattern)}
                                </p>
                            </>
                        }
                    </EditorialSettingsSection>

                    <EditorialSettingsSection title={copy.posts.form.taxonomySettings}>
                        <Field>
                            <FieldLabel htmlFor="categoryId">{copy.posts.form.category}</FieldLabel>
                            <Select
                                name="categoryId"
                                defaultValue={post?.categoryId ?? categories[0]?.id}
                                items={categories.map(category => ({ value: category.id, label: category.name }))}
                                required
                            >
                                <SelectTrigger id="categoryId" className="w-full">
                                    <SelectValue placeholder={copy.posts.form.selectCategory} />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {categories.length === 0 ?
                                <FieldDescription>{copy.posts.form.categoryRequired}</FieldDescription>
                            :   null}
                        </Field>

                        <Field>
                            <FieldLabel>{copy.posts.form.tags}</FieldLabel>
                            {tags.length === 0 ?
                                <FieldDescription>{copy.posts.form.noTags}</FieldDescription>
                            :   <div className="grid gap-2 sm:grid-cols-2">
                                    {tags.map(tag => (
                                        <label key={tag.id} className="flex min-h-10 items-center gap-3 text-sm">
                                            <input
                                                type="checkbox"
                                                name="tagIds"
                                                value={tag.id}
                                                defaultChecked={selectedTagIds.includes(tag.id)}
                                                className="size-4 rounded border-border"
                                            />
                                            {tag.name}
                                        </label>
                                    ))}
                                </div>
                            }
                        </Field>
                    </EditorialSettingsSection>
                </>
            }
        >
            <article className="editorial-composer">
                <EditorialTitleInput
                    name={titleFieldName}
                    value={title}
                    onChange={setTitle}
                    placeholder={copy.posts.form.titlePlaceholder}
                    label={titleField?.label ?? copy.posts.form.untitled}
                />
                {bodyField ?
                    <EditorialBlockCanvas
                        name={bodyField.name}
                        label={bodyField.label}
                        defaultValue={initialPostBody(fieldValues[bodyField.name])}
                        definitions={blockDefinitions}
                        choices={blockChoices}
                        media={postMedia}
                        messages={{ ...copy.editor.blocks, dragBlock: copy.pages.form.dragBlock }}
                        richTextMessages={{ ...copy.editor.richText, placeholder: copy.posts.form.bodyPlaceholder }}
                    />
                :   null}
            </article>
        </EditorialWorkspace>
    );
}

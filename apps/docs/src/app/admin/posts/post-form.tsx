"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Category, EditingField, Tag } from "@jamcaaxian/core/content";
import { CollectionEditingControls, type EditingControlValue } from "@jamcaaxian/editor";
import { createHttpMediaAdapter } from "@jamcaaxian/editor/media";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localizedBuiltinBlocks } from "@/content/admin-content";
import { setAdminCrumb } from "@/lib/admin-crumb";
import { useAdminI18n } from "@/components/admin/admin-i18n";
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

export function PostForm({
    post,
    fields,
    titleFieldName,
    mayPublish,
    address,
    categories,
    tags,
    selectedTagIds
}: {
    post?: PostDraft;
    fields: readonly EditingField[];
    titleFieldName: string;
    mayPublish: boolean;
    address: PostAddressSettings;
    categories: Category[];
    tags: Tag[];
    selectedTagIds: string[];
}) {
    const { locale, copy } = useAdminI18n();
    const [state, action, pending] = useActionState<PostFormState, FormData>(savePost, {});
    const [title, setTitle] = useState(String(post?.fields[titleFieldName] ?? ""));
    const titleField = fields.find(field => field.name === titleFieldName);
    const scalarFields = fields.filter(
        field => field.name !== titleFieldName && field.kind !== "richText" && field.kind !== "blocks"
    );
    const richTextFields = fields.filter(field => field.kind === "richText" || field.kind === "blocks");
    const fieldValues = post?.fields ?? {};
    const blockDefinitions = localizedBuiltinBlocks(locale);
    const allStatuses = [
        { value: "draft", label: copy.common.status.draft },
        { value: "published", label: copy.common.status.published },
        { value: "archived", label: copy.common.status.archived }
    ];
    // Publishing is withheld from the form as well as the action, so it is not
    // offered as something to attempt and be refused.
    const statuses = allStatuses.filter(status => status.value !== "published" || mayPublish);

    // The breadcrumb sits in the layout and only knows the address, which for a post
    // is an identifier. Telling it the title as it is typed is the point.
    useEffect(() => {
        setAdminCrumb(title.trim() || copy.posts.form.untitled);

        return () => setAdminCrumb(null);
    }, [copy.posts.form.untitled, title]);

    return (
        <form action={action} className="max-w-3xl [--jamcaa-editor-sticky-offset:3.5rem]">
            {post ?
                <input type="hidden" name="id" value={post.id} />
            :   null}

            <FieldGroup>
                <CollectionEditingControls
                    fields={titleField ? [titleField] : []}
                    values={{ ...fieldValues, [titleFieldName]: title }}
                    messages={copy.editor.collection}
                    onTextChange={(name, value) => {
                        if (name === titleFieldName) {
                            setTitle(value);
                        }
                    }}
                />

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
                        <p className="text-muted-foreground text-sm">
                            {copy.posts.form.addressDescription(address.pattern)}
                        </p>
                    </>
                }

                <CollectionEditingControls
                    fields={scalarFields}
                    values={fieldValues}
                    messages={copy.editor.collection}
                />

                <Field>
                    <FieldLabel htmlFor="categoryId">{copy.posts.form.category}</FieldLabel>
                    <Select
                        name="categoryId"
                        defaultValue={post?.categoryId ?? categories[0]?.id}
                        items={categories.map(category => ({ value: category.id, label: category.name }))}
                        required
                    >
                        <SelectTrigger id="categoryId" className="w-full sm:w-72">
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
                                <label key={tag.id} className="flex items-center gap-2 text-sm font-normal">
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

                <CollectionEditingControls
                    fields={richTextFields}
                    values={fieldValues}
                    messages={copy.editor.collection}
                    richText={{
                        media: postMedia,
                        messages: { ...copy.editor.richText, placeholder: copy.posts.form.bodyPlaceholder }
                    }}
                    blocks={{
                        definitions: blockDefinitions,
                        media: postMedia,
                        messages: copy.editor.blocks,
                        richTextMessages: {
                            ...copy.editor.richText,
                            placeholder: copy.posts.form.richTextBlockPlaceholder
                        }
                    }}
                />

                <Field>
                    <FieldLabel htmlFor="status">{copy.posts.form.status}</FieldLabel>
                    <Select name="status" defaultValue={post?.status ?? "draft"} items={statuses}>
                        <SelectTrigger id="status" className="w-full sm:w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {statuses.map(status => (
                                <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" disabled={pending || categories.length === 0} className="w-full sm:w-auto">
                        {pending ? copy.common.saving : copy.posts.form.save}
                    </Button>
                    <Button
                        variant="ghost"
                        nativeButton={false}
                        render={<Link href="/admin/posts" />}
                        className="w-full sm:w-auto"
                    >
                        {copy.common.cancel}
                    </Button>
                </div>
            </FieldGroup>
        </form>
    );
}

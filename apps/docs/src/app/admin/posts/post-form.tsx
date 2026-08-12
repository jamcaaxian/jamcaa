"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Category, EditingField, Tag } from "@jamcaa/core/content";
import { CollectionEditingControls, type EditingControlValue } from "@jamcaa/editor";
import { createHttpMediaAdapter } from "@jamcaa/editor/media";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setAdminCrumb } from "@/lib/admin-crumb";
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

const allStatuses = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" }
];

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
    const [state, action, pending] = useActionState<PostFormState, FormData>(savePost, {});
    const [title, setTitle] = useState(String(post?.fields[titleFieldName] ?? ""));
    const titleField = fields.find(field => field.name === titleFieldName);
    const scalarFields = fields.filter(field => field.name !== titleFieldName && field.kind !== "richText");
    const richTextFields = fields.filter(field => field.kind === "richText");
    const fieldValues = post?.fields ?? {};
    // Publishing is withheld from the form as well as the action, so it is not
    // offered as something to attempt and be refused.
    const statuses = allStatuses.filter(status => status.value !== "published" || mayPublish);

    // The breadcrumb sits in the layout and only knows the address, which for a post
    // is an identifier. Telling it the title as it is typed is the point.
    useEffect(() => {
        setAdminCrumb(title.trim() || "Untitled");

        return () => setAdminCrumb(null);
    }, [title]);

    return (
        <form action={action} className="max-w-3xl [--jamcaa-editor-sticky-offset:3.5rem]">
            {post ?
                <input type="hidden" name="id" value={post.id} />
            :   null}

            <FieldGroup>
                <CollectionEditingControls
                    fields={titleField ? [titleField] : []}
                    values={{ ...fieldValues, [titleFieldName]: title }}
                    onTextChange={(name, value) => {
                        if (name === titleFieldName) {
                            setTitle(value);
                        }
                    }}
                />

                {address.mayChooseSlug ?
                    <Field>
                        <FieldLabel htmlFor="slug">Slug</FieldLabel>
                        <Input id="slug" name="slug" defaultValue={post?.slug} placeholder="Taken from the title" />
                        <FieldDescription>
                            Leave this empty and the title decides. Public addresses follow {address.pattern}.
                        </FieldDescription>
                    </Field>
                :   <>
                        <input type="hidden" name="slug" value={post?.slug ?? ""} />
                        <p className="text-muted-foreground text-sm">Public addresses follow {address.pattern}.</p>
                    </>
                }

                <CollectionEditingControls fields={scalarFields} values={fieldValues} />

                <Field>
                    <FieldLabel htmlFor="categoryId">Category</FieldLabel>
                    <Select
                        name="categoryId"
                        defaultValue={post?.categoryId ?? categories[0]?.id}
                        items={categories.map(category => ({ value: category.id, label: category.name }))}
                        required
                    >
                        <SelectTrigger id="categoryId" className="w-full sm:w-72">
                            <SelectValue placeholder="Select a category" />
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
                        <FieldDescription>Create a category before saving a Post.</FieldDescription>
                    :   null}
                </Field>

                <Field>
                    <FieldLabel>Tags</FieldLabel>
                    {tags.length === 0 ?
                        <FieldDescription>No tags are available yet.</FieldDescription>
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
                    richText={{ media: postMedia, messages: { placeholder: "Write the Post body…" } }}
                />

                <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
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
                        {pending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                        variant="ghost"
                        nativeButton={false}
                        render={<Link href="/admin/posts" />}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                </div>
            </FieldGroup>
        </form>
    );
}

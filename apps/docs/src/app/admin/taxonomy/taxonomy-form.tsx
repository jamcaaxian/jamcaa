"use client";

import { useActionState } from "react";
import type { Category, Tag } from "@jamcaa/core/content";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteCategory, deleteTag, saveCategory, saveTag, type TaxonomyFormState } from "./actions";

const NONE = "__none__";

function Feedback({ state }: { state: TaxonomyFormState }) {
    if (state.error) {
        return <FieldError errors={[{ message: state.error }]} />;
    }

    return state.saved ? <p className="text-muted-foreground text-sm">Saved.</p> : null;
}

function CategoryForm({ category, categories }: { category?: Category; categories: Category[] }) {
    const [state, action, pending] = useActionState<TaxonomyFormState, FormData>(saveCategory, {});
    const parents = categories.filter(candidate => candidate.id !== category?.id);

    return (
        <form action={action} className="rounded-xl border p-4">
            {category ?
                <input type="hidden" name="id" value={category.id} />
            :   null}
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor={`category-name-${category?.id ?? "new"}`}>Name</FieldLabel>
                    <Input
                        id={`category-name-${category?.id ?? "new"}`}
                        name="name"
                        defaultValue={category?.name}
                        required
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor={`category-slug-${category?.id ?? "new"}`}>Slug</FieldLabel>
                    <Input id={`category-slug-${category?.id ?? "new"}`} name="slug" defaultValue={category?.slug} />
                    <FieldDescription>Leave empty to derive it from the name.</FieldDescription>
                </Field>
                <Field>
                    <FieldLabel htmlFor={`category-parent-${category?.id ?? "new"}`}>Parent</FieldLabel>
                    <Select
                        name="parentId"
                        defaultValue={category?.parentId ?? NONE}
                        items={[
                            { value: NONE, label: "No parent" },
                            ...parents.map(parent => ({ value: parent.id, label: parent.name }))
                        ]}
                    >
                        <SelectTrigger id={`category-parent-${category?.id ?? "new"}`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>No parent</SelectItem>
                            {parents.map(parent => (
                                <SelectItem key={parent.id} value={parent.id}>
                                    {parent.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Feedback state={state} />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending}>
                        {pending ?
                            "Saving…"
                        : category ?
                            "Save category"
                        :   "Add category"}
                    </Button>
                    {category ?
                        <Button
                            variant="outline"
                            nativeButton
                            render={<button type="submit" formAction={deleteCategory} name="id" value={category.id} />}
                        >
                            Delete
                        </Button>
                    :   null}
                </div>
            </FieldGroup>
        </form>
    );
}

function TagForm({ tag }: { tag?: Tag }) {
    const [state, action, pending] = useActionState<TaxonomyFormState, FormData>(saveTag, {});

    return (
        <form action={action} className="rounded-xl border p-4">
            {tag ?
                <input type="hidden" name="id" value={tag.id} />
            :   null}
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor={`tag-name-${tag?.id ?? "new"}`}>Name</FieldLabel>
                    <Input id={`tag-name-${tag?.id ?? "new"}`} name="name" defaultValue={tag?.name} required />
                </Field>
                <Field>
                    <FieldLabel htmlFor={`tag-slug-${tag?.id ?? "new"}`}>Slug</FieldLabel>
                    <Input id={`tag-slug-${tag?.id ?? "new"}`} name="slug" defaultValue={tag?.slug} />
                    <FieldDescription>Leave empty to derive it from the name.</FieldDescription>
                </Field>
                <Feedback state={state} />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending}>
                        {pending ?
                            "Saving…"
                        : tag ?
                            "Save tag"
                        :   "Add tag"}
                    </Button>
                    {tag ?
                        <Button
                            variant="outline"
                            nativeButton
                            render={<button type="submit" formAction={deleteTag} name="id" value={tag.id} />}
                        >
                            Delete
                        </Button>
                    :   null}
                </div>
            </FieldGroup>
        </form>
    );
}

export function TaxonomyForms({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
    return (
        <div className="grid gap-8 xl:grid-cols-2">
            <section className="space-y-4">
                <div>
                    <h2 className="font-semibold tracking-tight">Categories</h2>
                    <p className="text-muted-foreground text-sm">Hierarchical. Every Post belongs to exactly one.</p>
                </div>
                <CategoryForm categories={categories} />
                {categories.map(category => (
                    <CategoryForm key={category.id} category={category} categories={categories} />
                ))}
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="font-semibold tracking-tight">Tags</h2>
                    <p className="text-muted-foreground text-sm">Flat labels. A Post may use any number of them.</p>
                </div>
                <TagForm />
                {tags.map(tag => (
                    <TagForm key={tag.id} tag={tag} />
                ))}
            </section>
        </div>
    );
}

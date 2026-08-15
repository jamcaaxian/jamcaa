"use client";

import { useActionState } from "react";
import type { Category, Tag } from "@jamcaaxian/core/content";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteCategory, deleteTag, saveCategory, saveTag, type TaxonomyFormState } from "./actions";

const NONE = "__none__";

function Feedback({ state }: { state: TaxonomyFormState }) {
    const { copy } = useAdminI18n();

    if (state.error) {
        return <FieldError errors={[{ message: state.error }]} />;
    }

    return state.saved ? <p className="text-muted-foreground text-sm">{copy.common.saved}</p> : null;
}

function CategoryForm({ category, categories }: { category?: Category; categories: Category[] }) {
    const { copy } = useAdminI18n();
    const [state, action, pending] = useActionState<TaxonomyFormState, FormData>(saveCategory, {});
    const parents = categories.filter(candidate => candidate.id !== category?.id);

    return (
        <form action={action} className="rounded-xl border p-4">
            {category ?
                <input type="hidden" name="id" value={category.id} />
            :   null}
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor={`category-name-${category?.id ?? "new"}`}>{copy.taxonomy.name}</FieldLabel>
                    <Input
                        id={`category-name-${category?.id ?? "new"}`}
                        name="name"
                        defaultValue={category?.name}
                        required
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor={`category-slug-${category?.id ?? "new"}`}>{copy.taxonomy.slug}</FieldLabel>
                    <Input id={`category-slug-${category?.id ?? "new"}`} name="slug" defaultValue={category?.slug} />
                    <FieldDescription>{copy.taxonomy.slugDescription}</FieldDescription>
                </Field>
                <Field>
                    <FieldLabel htmlFor={`category-parent-${category?.id ?? "new"}`}>{copy.taxonomy.parent}</FieldLabel>
                    <Select
                        name="parentId"
                        defaultValue={category?.parentId ?? NONE}
                        items={[
                            { value: NONE, label: copy.taxonomy.noParent },
                            ...parents.map(parent => ({ value: parent.id, label: parent.name }))
                        ]}
                    >
                        <SelectTrigger id={`category-parent-${category?.id ?? "new"}`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>{copy.taxonomy.noParent}</SelectItem>
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
                            copy.common.saving
                        : category ?
                            copy.taxonomy.saveCategory
                        :   copy.taxonomy.addCategory}
                    </Button>
                    {category ?
                        <Button
                            variant="outline"
                            nativeButton
                            render={<button type="submit" formAction={deleteCategory} />}
                        >
                            {copy.common.delete}
                        </Button>
                    :   null}
                </div>
            </FieldGroup>
        </form>
    );
}

function TagForm({ tag }: { tag?: Tag }) {
    const { copy } = useAdminI18n();
    const [state, action, pending] = useActionState<TaxonomyFormState, FormData>(saveTag, {});

    return (
        <form action={action} className="rounded-xl border p-4">
            {tag ?
                <input type="hidden" name="id" value={tag.id} />
            :   null}
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor={`tag-name-${tag?.id ?? "new"}`}>{copy.taxonomy.name}</FieldLabel>
                    <Input id={`tag-name-${tag?.id ?? "new"}`} name="name" defaultValue={tag?.name} required />
                </Field>
                <Field>
                    <FieldLabel htmlFor={`tag-slug-${tag?.id ?? "new"}`}>{copy.taxonomy.slug}</FieldLabel>
                    <Input id={`tag-slug-${tag?.id ?? "new"}`} name="slug" defaultValue={tag?.slug} />
                    <FieldDescription>{copy.taxonomy.slugDescription}</FieldDescription>
                </Field>
                <Feedback state={state} />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending}>
                        {pending ?
                            copy.common.saving
                        : tag ?
                            copy.taxonomy.saveTag
                        :   copy.taxonomy.addTag}
                    </Button>
                    {tag ?
                        <Button variant="outline" nativeButton render={<button type="submit" formAction={deleteTag} />}>
                            {copy.common.delete}
                        </Button>
                    :   null}
                </div>
            </FieldGroup>
        </form>
    );
}

export function TaxonomyForms({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
    const { copy } = useAdminI18n();

    return (
        <div className="grid gap-8 xl:grid-cols-2">
            <section className="space-y-4">
                <div>
                    <h2 className="font-semibold tracking-tight">{copy.taxonomy.categories}</h2>
                    <p className="text-muted-foreground text-sm">{copy.taxonomy.categoriesDescription}</p>
                </div>
                <CategoryForm categories={categories} />
                {categories.map(category => (
                    <CategoryForm key={category.id} category={category} categories={categories} />
                ))}
            </section>

            <section className="space-y-4">
                <div>
                    <h2 className="font-semibold tracking-tight">{copy.taxonomy.tags}</h2>
                    <p className="text-muted-foreground text-sm">{copy.taxonomy.tagsDescription}</p>
                </div>
                <TagForm />
                {tags.map(tag => (
                    <TagForm key={tag.id} tag={tag} />
                ))}
            </section>
        </div>
    );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { RichTextDocument } from "@jamcaa/core/content";
import { RichTextEditor } from "@jamcaa/editor";
import { createHttpMediaAdapter } from "@jamcaa/editor/media";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setAdminCrumb } from "@/lib/admin-crumb";
import { savePost, type PostFormState } from "./actions";

export interface PostDraft {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body: RichTextDocument;
    status: string;
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
    mayPublish,
    address
}: {
    post?: PostDraft;
    mayPublish: boolean;
    address: PostAddressSettings;
}) {
    const [state, action, pending] = useActionState<PostFormState, FormData>(savePost, {});
    const [title, setTitle] = useState(post?.title ?? "");
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
                <Field>
                    <FieldLabel htmlFor="title">Title</FieldLabel>
                    <Input
                        id="title"
                        name="title"
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                        required
                    />
                </Field>

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

                <Field>
                    <FieldLabel htmlFor="excerpt">Excerpt</FieldLabel>
                    <Input id="excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} />
                </Field>

                <Field>
                    <FieldLabel id="body-label" htmlFor="body-editor">
                        Body
                    </FieldLabel>
                    <RichTextEditor
                        name="body"
                        label="Post body"
                        labelledBy="body-label"
                        defaultValue={post?.body}
                        media={postMedia}
                        messages={{ placeholder: "Write the Post body…" }}
                    />
                    <FieldDescription>Rich text. Images remain managed as Media.</FieldDescription>
                </Field>

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
                    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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

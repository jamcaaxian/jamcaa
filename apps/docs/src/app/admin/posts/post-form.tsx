"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setAdminCrumb } from "@/lib/admin-crumb";
import { savePost, type PostFormState } from "./actions";

export interface PostDraft {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body: string;
    status: string;
}

const allStatuses = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" }
];

export function PostForm({ post, mayPublish }: { post?: PostDraft; mayPublish: boolean }) {
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
        <form action={action} className="max-w-3xl">
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
                        autoFocus
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="slug">Address</FieldLabel>
                    <Input id="slug" name="slug" defaultValue={post?.slug} placeholder="Taken from the title" />
                    <FieldDescription>Leave this empty and the title decides.</FieldDescription>
                </Field>

                <Field>
                    <FieldLabel htmlFor="excerpt">Excerpt</FieldLabel>
                    <Input id="excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} />
                </Field>

                <Field>
                    <FieldLabel htmlFor="body">Body</FieldLabel>
                    <Textarea
                        id="body"
                        name="body"
                        defaultValue={post?.body}
                        rows={18}
                        required
                        className="font-mono"
                    />
                    <FieldDescription>Markdown.</FieldDescription>
                </Field>

                <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <Select name="status" defaultValue={post?.status ?? "draft"} items={statuses}>
                        <SelectTrigger id="status" className="w-56">
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

                <div className="flex gap-2">
                    <Button type="submit" disabled={pending}>
                        {pending ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="ghost" nativeButton={false} render={<Link href="/admin/posts" />}>
                        Cancel
                    </Button>
                </div>
            </FieldGroup>
        </form>
    );
}

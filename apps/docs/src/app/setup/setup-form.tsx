"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createFirstAdministrator, type SetupState } from "./actions";

export function SetupForm() {
    const [state, action, pending] = useActionState<SetupState, FormData>(createFirstAdministrator, {});

    return (
        <form action={action}>
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="siteTitle">Site title</FieldLabel>
                    <Input id="siteTitle" name="siteTitle" required />
                    <FieldDescription>Changed later under Settings.</FieldDescription>
                </Field>

                <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input id="name" name="name" autoComplete="name" required />
                </Field>

                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>

                <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                    <FieldDescription>At least eight characters.</FieldDescription>
                </Field>

                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}

                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending ? "Creating…" : "Create administrator"}
                </Button>
            </FieldGroup>
        </form>
    );
}

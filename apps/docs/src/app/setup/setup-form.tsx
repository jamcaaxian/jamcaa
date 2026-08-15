"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminCopy } from "@/content/admin-copy";
import { createFirstAdministrator, type SetupState } from "./actions";

type SetupFormCopy = Pick<
    AdminCopy["auth"]["setup"],
    | "siteTitle"
    | "siteTitleDescription"
    | "name"
    | "email"
    | "password"
    | "passwordDescription"
    | "submit"
    | "submitting"
>;

export function SetupForm({ copy }: { copy: SetupFormCopy }) {
    const [state, action, pending] = useActionState<SetupState, FormData>(createFirstAdministrator, {});

    return (
        <form action={action}>
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="siteTitle">{copy.siteTitle}</FieldLabel>
                    <Input id="siteTitle" name="siteTitle" required />
                    <FieldDescription>{copy.siteTitleDescription}</FieldDescription>
                </Field>

                <Field>
                    <FieldLabel htmlFor="name">{copy.name}</FieldLabel>
                    <Input id="name" name="name" autoComplete="name" required />
                </Field>

                <Field>
                    <FieldLabel htmlFor="email">{copy.email}</FieldLabel>
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>

                <Field>
                    <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                    <FieldDescription>{copy.passwordDescription}</FieldDescription>
                </Field>

                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}

                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending ? copy.submitting : copy.submit}
                </Button>
            </FieldGroup>
        </form>
    );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminCopy } from "@/content/admin-copy";
import { signIn, type SignInState } from "./actions";

type SignInFormCopy = Pick<AdminCopy["auth"]["login"], "email" | "password" | "submit" | "submitting">;

export function SignInForm({ next, copy }: { next: string; copy: SignInFormCopy }) {
    const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

    return (
        <form action={action}>
            <input type="hidden" name="next" value={next} />
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">{copy.email}</FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        defaultValue={state.email}
                        required
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
                    <Input id="password" name="password" type="password" autoComplete="current-password" required />
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

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
    const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

    return (
        <form action={action}>
            <input type="hidden" name="next" value={next} />
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
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
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </Field>

                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}

                <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending ? "Signing in…" : "Sign in"}
                </Button>
            </FieldGroup>
        </form>
    );
}

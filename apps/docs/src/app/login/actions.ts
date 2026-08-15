"use server";

import { redirect } from "next/navigation";
import { adminMessages } from "@/content/admin-locale";
import { getAuth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";

export type SignInState = { error?: string; email?: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
    const { copy } = await adminMessages();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = safeNextPath(String(formData.get("next") ?? ""));

    if (!email || !password) {
        return { error: copy.auth.login.required, email };
    }

    const auth = await getAuth();

    try {
        await auth.api.signInEmail({ body: { email, password } });
    } catch {
        // Deliberately the same message whether or not the account exists, so
        // this form cannot be used to discover who has one. The email is echoed
        // back so a retry does not mean retyping it; the password never is.
        return { error: copy.auth.login.invalid, email };
    }

    // Outside the catch: redirect signals by throwing.
    redirect(next);
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminMessages } from "@/content/admin-locale";
import { publicSiteSettings } from "@/content/public-site";
import { getSession, isInstalled, safeNextPath } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.auth.login.title };
}

// Reads the session and the installation state, neither of which exists at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    if (!(await isInstalled())) {
        redirect("/setup");
    }

    const next = safeNextPath((await searchParams).next);

    if (await getSession()) {
        redirect(next);
    }

    const { copy } = await adminMessages();
    const siteTitle = (await publicSiteSettings()).get("site.title");

    return (
        <main id="main-content" className="relative flex min-h-svh items-center justify-center p-4 sm:p-6">
            <div
                aria-hidden="true"
                className="bg-primary/8 pointer-events-none absolute top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
            />
            <div className="shadow-soft w-full max-w-sm rounded-3xl bg-card p-8">
                <div className="mb-8 space-y-2 text-center">
                    <p className="bg-primary/10 text-primary mx-auto inline-flex rounded-full px-2.5 py-0.5 font-mono text-xs">
                        {siteTitle}
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">{copy.auth.login.title}</h1>
                    <p className="text-muted-foreground text-sm">{copy.auth.login.description(siteTitle)}</p>
                </div>
                <SignInForm
                    next={next}
                    copy={{
                        email: copy.auth.login.email,
                        password: copy.auth.login.password,
                        submit: copy.auth.login.submit,
                        submitting: copy.auth.login.submitting
                    }}
                />
            </div>
        </main>
    );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, isInstalled, safeNextPath } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
    title: "Sign in"
};

// Reads the session and the installation state, neither of which exists at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage({
    searchParams
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    if (!(await isInstalled())) {
        redirect("/setup");
    }

    const next = safeNextPath((await searchParams).next);

    if (await getSession()) {
        redirect(next);
    }

    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Sign in</CardTitle>
                    <CardDescription>Continue to the jamcaa admin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SignInForm next={next} />
                </CardContent>
            </Card>
        </main>
    );
}

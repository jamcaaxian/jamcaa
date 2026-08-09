import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isInstalled } from "@/lib/session";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up" };

// Whether the site has an account is a runtime question, not a build-time one.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
    if (await isInstalled()) {
        redirect("/login");
    }

    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Create the first administrator</CardTitle>
                    <CardDescription>
                        This site has no accounts yet. Once one exists, this page closes for good.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SetupForm />
                </CardContent>
            </Card>
        </main>
    );
}

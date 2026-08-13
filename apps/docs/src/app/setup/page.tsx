import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { checkRequirements } from "@jamcaaxian/core/install";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { installPlan } from "@/content/install";
import { siteSettings } from "@/content/settings";
import { isInstalled } from "@/lib/session";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up" };

// Whether the site has an account is a runtime question, not a build-time one.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
    if (await isInstalled()) {
        redirect("/login");
    }

    const { env } = getCloudflareContext();
    const requirements = await checkRequirements({
        database: createDatabase(env.DB),
        bindings: env as unknown as Record<string, unknown>,
        settings: siteSettings,
        plan: installPlan,
        authSecret: env.BETTER_AUTH_SECRET,
        authUrl: env.BETTER_AUTH_URL
    });

    const unmet = requirements.filter(requirement => !requirement.met);

    return (
        <main id="main-content" className="flex min-h-svh items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>{unmet.length > 0 ? "Almost ready" : "Set up this site"}</CardTitle>
                    <CardDescription>
                        {unmet.length > 0 ?
                            "A few things are not in place yet. Each one says what to do about it."
                        :   "This site has no accounts yet. Once one exists, this page closes for good."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ul className="space-y-3">
                        {requirements.map(requirement => (
                            <li key={requirement.name} className="flex gap-3 text-sm">
                                {requirement.met ?
                                    <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                                :   <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" />}
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className={requirement.met ? "text-muted-foreground" : ""}>
                                        {requirement.name}
                                    </div>
                                    {requirement.met ? null : (
                                        <code className="bg-muted block max-w-full overflow-x-auto rounded-md px-2 py-1 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
                                            {requirement.remedy}
                                        </code>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>

                    {unmet.length === 0 ?
                        <SetupForm />
                    :   null}
                </CardContent>
            </Card>
        </main>
    );
}

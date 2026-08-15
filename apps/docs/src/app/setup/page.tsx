import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabase } from "@jamcaaxian/core";
import { checkRequirements, type Requirement } from "@jamcaaxian/core/install";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminCopy } from "@/content/admin-copy";
import { adminMessages } from "@/content/admin-locale";
import { installPlan } from "@/content/install";
import { siteSettings } from "@/content/settings";
import { isInstalled } from "@/lib/session";
import { SetupForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.auth.setup.title };
}

// Whether the site has an account is a runtime question, not a build-time one.
export const dynamic = "force-dynamic";

function localizeRequirement(requirement: Requirement, copy: AdminCopy["auth"]["setup"]["requirements"]) {
    if (requirement.code === "database-migrated") {
        return { name: copy.databaseName, remedy: copy.databaseRemedy };
    }

    if (requirement.code === "bucket-bound") {
        const binding = requirement.bucket?.binding ?? "<binding>";
        const bucketName = requirement.bucket?.bucketName ?? "<bucket>";

        return {
            name: copy.bucketName(requirement.bucket?.label ?? bucketName, binding),
            remedy: copy.bucketRemedy(binding, bucketName)
        };
    }

    if (requirement.code === "signing-secret") {
        return { name: copy.signingName, remedy: copy.signingRemedy };
    }

    return { name: copy.addressName, remedy: copy.addressRemedy };
}

export default async function SetupPage() {
    if (await isInstalled()) {
        redirect("/login");
    }

    const { copy } = await adminMessages();
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
                    <CardTitle>
                        {unmet.length > 0 ? copy.auth.setup.blockedTitle : copy.auth.setup.readyTitle}
                    </CardTitle>
                    <CardDescription>
                        {unmet.length > 0 ? copy.auth.setup.blockedDescription : copy.auth.setup.readyDescription}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ul className="space-y-3">
                        {requirements.map(requirement => {
                            const localized = localizeRequirement(requirement, copy.auth.setup.requirements);

                            return (
                                <li key={`${requirement.code}-${requirement.name}`} className="flex gap-3 text-sm">
                                    {requirement.met ?
                                        <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                                    :   <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" />}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className={requirement.met ? "text-muted-foreground" : ""}>
                                            {localized.name}
                                        </div>
                                        {requirement.met ? null : (
                                            <code className="bg-muted block max-w-full overflow-x-auto rounded-md px-2 py-1 font-mono text-xs whitespace-pre-wrap wrap-anywhere">
                                                {localized.remedy}
                                            </code>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {unmet.length === 0 ?
                        <SetupForm
                            copy={{
                                siteTitle: copy.auth.setup.siteTitle,
                                siteTitleDescription: copy.auth.setup.siteTitleDescription,
                                name: copy.auth.setup.name,
                                email: copy.auth.setup.email,
                                password: copy.auth.setup.password,
                                passwordDescription: copy.auth.setup.passwordDescription,
                                submit: copy.auth.setup.submit,
                                submitting: copy.auth.setup.submitting
                            }}
                        />
                    :   null}
                </CardContent>
            </Card>
        </main>
    );
}

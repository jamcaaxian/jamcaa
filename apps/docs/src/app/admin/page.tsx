import { adminCopy } from "@/content/admin-copy";
import { adminLocale } from "@/content/admin-locale";

export default async function AdminOverviewPage() {
    const copy = adminCopy(await adminLocale());

    return (
        <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{copy.shell.overview.title}</h1>
            <p className="text-muted-foreground text-sm">{copy.shell.overview.description}</p>
        </div>
    );
}

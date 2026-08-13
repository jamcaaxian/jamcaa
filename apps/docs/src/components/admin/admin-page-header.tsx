export function AdminPageHeader({
    title,
    description,
    children
}: {
    title: string;
    description?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                {description ?
                    <p className="text-muted-foreground text-sm">{description}</p>
                :   null}
            </div>
            {children ?
                <div className="flex items-center gap-2">{children}</div>
            :   null}
        </div>
    );
}

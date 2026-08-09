import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { createStorageConfiguration, type ManagedStorageRule, type StorageConditions } from "@jamcaa/core/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { moveRule } from "./actions";
import { BucketForm } from "./bucket-form";
import { DeleteStorageButton } from "./delete-storage-button";
import { FallbackForm } from "./fallback-form";
import { RuleForm } from "./rule-form";

export const metadata: Metadata = { title: "Storage" };

function readableSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${bytes / (1024 * 1024)} MB`;
}

function conditionSummary(conditions: StorageConditions | undefined) {
    if (conditions === undefined) {
        return "Damaged conditions — this rule is skipped";
    }

    const parts = [
        conditions.collections?.length ? `collection: ${conditions.collections.join(", ")}` : undefined,
        conditions.categories?.length ? `category: ${conditions.categories.join(", ")}` : undefined,
        conditions.tags?.length ? `tag: ${conditions.tags.join(", ")}` : undefined,
        conditions.authorRoles?.length ? `role: ${conditions.authorRoles.join(", ")}` : undefined,
        conditions.authorIds?.length ?
            `${conditions.authorIds.length} author ID${conditions.authorIds.length === 1 ? "" : "s"}`
        :   undefined,
        conditions.mimePrefixes?.length ? `type: ${conditions.mimePrefixes.join(", ")}` : undefined,
        conditions.minSize !== undefined ? `at least ${readableSize(conditions.minSize)}` : undefined,
        conditions.maxSize !== undefined ? `at most ${readableSize(conditions.maxSize)}` : undefined,
        conditions.from ? `from ${conditions.from.slice(0, 10)}` : undefined,
        conditions.until ? `until ${conditions.until.slice(0, 10)}` : undefined
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : "Every upload";
}

function MoveRuleButtons({ rule, index, total }: { rule: ManagedStorageRule; index: number; total: number }) {
    return (
        <div className="flex items-center">
            <form action={moveRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="direction" value="up" />
                <Button type="submit" variant="ghost" size="icon-sm" disabled={index === 0} aria-label="Move rule up">
                    <ArrowUp />
                </Button>
            </form>
            <form action={moveRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="direction" value="down" />
                <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === total - 1}
                    aria-label="Move rule down"
                >
                    <ArrowDown />
                </Button>
            </form>
        </div>
    );
}

export default async function StoragePage() {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">You do not have permission to see storage settings.</p>;
    }

    const { database, bindings } = mediaRuntime();
    const [configuration, mayManage] = await Promise.all([
        createStorageConfiguration({ database, bindings }).inspect(),
        may(actor, "settings", "manage")
    ]);
    const fallback = configuration.rules.find(rule => rule.isFallback);
    const rules = configuration.rules.filter(rule => !rule.isFallback);

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">Storage</h1>
                <p className="text-muted-foreground text-sm">
                    Buckets describe reachable storage. Ordered rules decide where each new file lands.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fallback destination</CardTitle>
                    <CardDescription>
                        This catches every upload no earlier rule claims. It cannot be removed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {fallback ?
                        mayManage ?
                            <FallbackForm buckets={configuration.buckets} bucketId={fallback.bucketId} />
                        :   <p className="text-sm">
                                {configuration.buckets.find(bucket => bucket.id === fallback.bucketId)?.label
                                    ?? fallback.bucketId}
                            </p>

                    :   <p className="text-destructive text-sm">The fallback rule is missing. Uploads may fail.</p>}
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">Buckets</h2>
                        <p className="text-muted-foreground text-sm">
                            {configuration.buckets.length === 1 ?
                                "One destination"
                            :   `${configuration.buckets.length} destinations`}
                        </p>
                    </div>
                    {mayManage ?
                        <Sheet>
                            <SheetTrigger render={<Button size="sm" />}>
                                <Plus />
                                Add bucket
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-md">
                                <SheetHeader>
                                    <SheetTitle>Add an R2 bucket</SheetTitle>
                                    <SheetDescription>
                                        The deployment binding must exist before it can be registered here.
                                    </SheetDescription>
                                </SheetHeader>
                                <BucketForm />
                            </SheetContent>
                        </Sheet>
                    :   null}
                </div>

                <div className="overflow-hidden rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bucket</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Use</TableHead>
                                <TableHead>Status</TableHead>
                                {mayManage ?
                                    <TableHead className="text-right">Actions</TableHead>
                                :   null}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {configuration.buckets.map(bucket => (
                                <TableRow key={bucket.id}>
                                    <TableCell>
                                        <div className="font-medium">{bucket.label}</div>
                                        <div className="text-muted-foreground font-mono text-xs">{bucket.id}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-mono text-xs">{bucket.binding ?? bucket.endpoint}</div>
                                        {bucket.bucketName ?
                                            <div className="text-muted-foreground text-xs">{bucket.bucketName}</div>
                                        :   null}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {bucket.mediaCount} media · {bucket.ruleCount} rules
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1.5">
                                            <Badge variant={bucket.reachable ? "secondary" : "destructive"}>
                                                {bucket.reachable ? "Reachable" : "Unavailable"}
                                            </Badge>
                                            {bucket.isFallbackTarget ?
                                                <Badge variant="outline">Fallback</Badge>
                                            :   null}
                                        </div>
                                    </TableCell>
                                    {mayManage ?
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Sheet>
                                                    <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                                        Edit
                                                    </SheetTrigger>
                                                    <SheetContent className="sm:max-w-md">
                                                        <SheetHeader>
                                                            <SheetTitle>Edit {bucket.label}</SheetTitle>
                                                            <SheetDescription>
                                                                Rename the destination or change how stored files are
                                                                served.
                                                            </SheetDescription>
                                                        </SheetHeader>
                                                        <BucketForm bucket={bucket} />
                                                    </SheetContent>
                                                </Sheet>
                                                <DeleteStorageButton
                                                    kind="bucket"
                                                    id={bucket.id}
                                                    label={bucket.label}
                                                    disabled={!bucket.mayDelete}
                                                    reason={bucket.deleteBlocker}
                                                />
                                            </div>
                                        </TableCell>
                                    :   null}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <p className="text-muted-foreground text-xs">
                    External S3-compatible credentials are deliberately not editable here until jamcaa can seal them at
                    rest.
                </p>
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">Routing rules</h2>
                        <p className="text-muted-foreground text-sm">
                            First matching rule wins. The fallback always runs last.
                        </p>
                    </div>
                    {mayManage ?
                        <Sheet>
                            <SheetTrigger render={<Button size="sm" />}>
                                <Plus />
                                Add rule
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-lg">
                                <SheetHeader>
                                    <SheetTitle>Add a routing rule</SheetTitle>
                                    <SheetDescription>
                                        Choose a destination and describe which uploads it claims.
                                    </SheetDescription>
                                </SheetHeader>
                                <RuleForm buckets={configuration.buckets} />
                            </SheetContent>
                        </Sheet>
                    :   null}
                </div>

                {rules.length === 0 ?
                    <Card size="sm">
                        <CardHeader>
                            <CardTitle>No routing rules</CardTitle>
                            <CardDescription>Every upload currently goes to the fallback destination.</CardDescription>
                        </CardHeader>
                        {mayManage ?
                            <CardAction>
                                <Badge variant="outline">Safe default</Badge>
                            </CardAction>
                        :   null}
                    </Card>
                :   <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {mayManage ?
                                        <TableHead className="w-20">Order</TableHead>
                                    :   null}
                                    <TableHead>Rule</TableHead>
                                    <TableHead>Conditions</TableHead>
                                    <TableHead>Destination</TableHead>
                                    {mayManage ?
                                        <TableHead className="text-right">Actions</TableHead>
                                    :   null}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map((rule, index) => (
                                    <TableRow key={rule.id}>
                                        {mayManage ?
                                            <TableCell>
                                                <MoveRuleButtons rule={rule} index={index} total={rules.length} />
                                            </TableCell>
                                        :   null}
                                        <TableCell>
                                            <div className="font-medium">{rule.label}</div>
                                            <div className="text-muted-foreground text-xs">
                                                Priority {rule.priority}
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className={
                                                rule.conditions === undefined ?
                                                    "text-destructive"
                                                :   "text-muted-foreground"
                                            }
                                        >
                                            <div className="max-w-md whitespace-normal text-xs">
                                                {conditionSummary(rule.conditions)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {configuration.buckets.find(bucket => bucket.id === rule.bucketId)?.label
                                                ?? rule.bucketId}
                                        </TableCell>
                                        {mayManage ?
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Sheet>
                                                        <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                                            Edit
                                                        </SheetTrigger>
                                                        <SheetContent className="sm:max-w-lg">
                                                            <SheetHeader>
                                                                <SheetTitle>Edit {rule.label}</SheetTitle>
                                                                <SheetDescription>
                                                                    Existing media stays where it is; this changes
                                                                    future uploads only.
                                                                </SheetDescription>
                                                            </SheetHeader>
                                                            <RuleForm rule={rule} buckets={configuration.buckets} />
                                                        </SheetContent>
                                                    </Sheet>
                                                    <DeleteStorageButton kind="rule" id={rule.id} label={rule.label} />
                                                </div>
                                            </TableCell>
                                        :   null}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                }
            </section>
        </div>
    );
}

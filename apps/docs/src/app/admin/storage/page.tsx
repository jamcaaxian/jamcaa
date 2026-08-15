import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { createStorageConfiguration, type ManagedStorageRule, type StorageConditions } from "@jamcaaxian/core/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminCopy } from "@/content/admin-copy";
import { adminMessages } from "@/content/admin-locale";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { moveRule } from "./actions";
import { BucketForm } from "./bucket-form";
import { DeleteStorageButton } from "./delete-storage-button";
import { FallbackForm } from "./fallback-form";
import { RuleForm } from "./rule-form";

export async function generateMetadata(): Promise<Metadata> {
    const { copy } = await adminMessages();

    return { title: copy.storage.title };
}

function readableSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${bytes / (1024 * 1024)} MB`;
}

function conditionSummary(conditions: StorageConditions | undefined, copy: AdminCopy["storage"]["rules"]) {
    if (conditions === undefined) {
        return copy.damaged;
    }

    const parts = [
        conditions.collections?.length ? copy.collection(conditions.collections.join(", ")) : undefined,
        conditions.categories?.length ? copy.category(conditions.categories.join(", ")) : undefined,
        conditions.tags?.length ? copy.tag(conditions.tags.join(", ")) : undefined,
        conditions.authorRoles?.length ? copy.role(conditions.authorRoles.join(", ")) : undefined,
        conditions.authorIds?.length ? copy.authorIds(conditions.authorIds.length) : undefined,
        conditions.mimePrefixes?.length ? copy.type(conditions.mimePrefixes.join(", ")) : undefined,
        conditions.minSize !== undefined ? copy.atLeast(readableSize(conditions.minSize)) : undefined,
        conditions.maxSize !== undefined ? copy.atMost(readableSize(conditions.maxSize)) : undefined,
        conditions.from ? copy.from(conditions.from.slice(0, 10)) : undefined,
        conditions.until ? copy.until(conditions.until.slice(0, 10)) : undefined
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : copy.everyUpload;
}

function MoveRuleButtons({
    rule,
    index,
    total,
    labels
}: {
    rule: ManagedStorageRule;
    index: number;
    total: number;
    labels: Pick<AdminCopy["storage"]["rules"], "moveUp" | "moveDown">;
}) {
    return (
        <div className="flex items-center">
            <form action={moveRule}>
                <input type="hidden" name="id" value={rule.id} />
                <input type="hidden" name="direction" value="up" />
                <Button type="submit" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={labels.moveUp}>
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
                    aria-label={labels.moveDown}
                >
                    <ArrowDown />
                </Button>
            </form>
        </div>
    );
}

type InspectedBucket = Awaited<ReturnType<ReturnType<typeof createStorageConfiguration>["inspect"]>>["buckets"][number];

function BucketStatus({ bucket, copy }: { bucket: InspectedBucket; copy: AdminCopy["storage"]["buckets"] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            <Badge variant={bucket.reachable ? "secondary" : "destructive"}>
                {bucket.reachable ? copy.reachable : copy.unavailable}
            </Badge>
            {bucket.isFallbackTarget ?
                <Badge variant="outline">{copy.fallback}</Badge>
            :   null}
        </div>
    );
}

export default async function StoragePage() {
    const { copy } = await adminMessages();
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "read"))) {
        return <p className="text-muted-foreground text-sm">{copy.storage.permission}</p>;
    }

    const { database, bindings } = mediaRuntime();
    const [configuration, mayManage] = await Promise.all([
        createStorageConfiguration({ database, bindings }).inspect(),
        may(actor, "settings", "manage")
    ]);
    const fallback = configuration.rules.find(rule => rule.isFallback);
    const rules = configuration.rules.filter(rule => !rule.isFallback);
    const deleteBlocker = (reason: string | undefined) =>
        reason === "Move or delete every rule that uses this bucket first." ? copy.storage.buckets.blockedByRules
        : reason === "This bucket still holds media." ? copy.storage.buckets.blockedByMedia
        : reason;

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight">{copy.storage.title}</h1>
                <p className="text-muted-foreground text-sm">{copy.storage.description}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{copy.storage.fallback.title}</CardTitle>
                    <CardDescription>{copy.storage.fallback.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {fallback ?
                        mayManage ?
                            <FallbackForm buckets={configuration.buckets} bucketId={fallback.bucketId} />
                        :   <p className="text-sm">
                                {configuration.buckets.find(bucket => bucket.id === fallback.bucketId)?.label
                                    ?? fallback.bucketId}
                            </p>

                    :   <p className="text-destructive text-sm">{copy.storage.fallback.missing}</p>}
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">{copy.storage.buckets.title}</h2>
                        <p className="text-muted-foreground text-sm">
                            {copy.storage.buckets.count(configuration.buckets.length)}
                        </p>
                    </div>
                    {mayManage ?
                        <Sheet>
                            <SheetTrigger render={<Button size="sm" />}>
                                <Plus />
                                {copy.storage.buckets.add}
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-md">
                                <SheetHeader>
                                    <SheetTitle>{copy.storage.buckets.addTitle}</SheetTitle>
                                    <SheetDescription>{copy.storage.buckets.addDescription}</SheetDescription>
                                </SheetHeader>
                                <BucketForm />
                            </SheetContent>
                        </Sheet>
                    :   null}
                </div>

                <ul className="space-y-3 lg:hidden">
                    {configuration.buckets.map(bucket => (
                        <li key={bucket.id} className="space-y-4 rounded-xl border p-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="font-medium wrap-anywhere">{bucket.label}</h3>
                                    <p className="text-muted-foreground mt-1 font-mono text-xs wrap-anywhere">
                                        {bucket.id}
                                    </p>
                                </div>
                                <BucketStatus bucket={bucket} copy={copy.storage.buckets} />
                            </div>
                            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-muted-foreground text-xs">{copy.storage.buckets.location}</dt>
                                    <dd className="mt-1 font-mono text-xs wrap-anywhere">
                                        {bucket.binding ?? bucket.endpoint}
                                        {bucket.bucketName ? ` / ${bucket.bucketName}` : ""}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground text-xs">{copy.storage.buckets.use}</dt>
                                    <dd className="mt-1 text-xs">
                                        {copy.storage.buckets.usage(bucket.mediaCount, bucket.ruleCount)}
                                    </dd>
                                </div>
                            </dl>
                            {mayManage ?
                                <div className="flex flex-wrap justify-end gap-1 border-t pt-3">
                                    <Sheet>
                                        <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                            {copy.common.edit}
                                        </SheetTrigger>
                                        <SheetContent className="sm:max-w-md">
                                            <SheetHeader>
                                                <SheetTitle>{copy.storage.buckets.editTitle(bucket.label)}</SheetTitle>
                                                <SheetDescription>
                                                    {copy.storage.buckets.editDescription}
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
                                        reason={deleteBlocker(bucket.deleteBlocker)}
                                    />
                                </div>
                            :   null}
                        </li>
                    ))}
                </ul>

                <div className="hidden overflow-hidden rounded-xl border lg:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{copy.storage.buckets.bucket}</TableHead>
                                <TableHead>{copy.storage.buckets.location}</TableHead>
                                <TableHead>{copy.storage.buckets.use}</TableHead>
                                <TableHead>{copy.storage.buckets.status}</TableHead>
                                {mayManage ?
                                    <TableHead className="text-right">{copy.storage.buckets.actions}</TableHead>
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
                                        {copy.storage.buckets.usage(bucket.mediaCount, bucket.ruleCount)}
                                    </TableCell>
                                    <TableCell>
                                        <BucketStatus bucket={bucket} copy={copy.storage.buckets} />
                                    </TableCell>
                                    {mayManage ?
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Sheet>
                                                    <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                                        {copy.common.edit}
                                                    </SheetTrigger>
                                                    <SheetContent className="sm:max-w-md">
                                                        <SheetHeader>
                                                            <SheetTitle>
                                                                {copy.storage.buckets.editTitle(bucket.label)}
                                                            </SheetTitle>
                                                            <SheetDescription>
                                                                {copy.storage.buckets.editDescription}
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
                                                    reason={deleteBlocker(bucket.deleteBlocker)}
                                                />
                                            </div>
                                        </TableCell>
                                    :   null}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <p className="text-muted-foreground text-xs">{copy.storage.buckets.credentialsNote}</p>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">{copy.storage.rules.title}</h2>
                        <p className="text-muted-foreground text-sm">{copy.storage.rules.description}</p>
                    </div>
                    {mayManage ?
                        <Sheet>
                            <SheetTrigger render={<Button size="sm" />}>
                                <Plus />
                                {copy.storage.rules.add}
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-lg">
                                <SheetHeader>
                                    <SheetTitle>{copy.storage.rules.addTitle}</SheetTitle>
                                    <SheetDescription>{copy.storage.rules.addDescription}</SheetDescription>
                                </SheetHeader>
                                <RuleForm buckets={configuration.buckets} />
                            </SheetContent>
                        </Sheet>
                    :   null}
                </div>

                {rules.length === 0 ?
                    <Card size="sm">
                        <CardHeader>
                            <CardTitle>{copy.storage.rules.emptyTitle}</CardTitle>
                            <CardDescription>{copy.storage.rules.emptyDescription}</CardDescription>
                        </CardHeader>
                        {mayManage ?
                            <CardAction>
                                <Badge variant="outline">{copy.storage.rules.safeDefault}</Badge>
                            </CardAction>
                        :   null}
                    </Card>
                :   <>
                        <ul className="space-y-3 lg:hidden">
                            {rules.map((rule, index) => (
                                <li key={rule.id} className="space-y-4 rounded-xl border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-medium wrap-anywhere">{rule.label}</h3>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {copy.storage.rules.priority(rule.priority)}
                                            </p>
                                        </div>
                                        {mayManage ?
                                            <MoveRuleButtons
                                                rule={rule}
                                                index={index}
                                                total={rules.length}
                                                labels={copy.storage.rules}
                                            />
                                        :   null}
                                    </div>
                                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                        <div>
                                            <dt className="text-muted-foreground text-xs">
                                                {copy.storage.rules.conditions}
                                            </dt>
                                            <dd
                                                className={
                                                    rule.conditions === undefined ?
                                                        "text-destructive mt-1 text-xs wrap-anywhere"
                                                    :   "mt-1 text-xs wrap-anywhere"
                                                }
                                            >
                                                {conditionSummary(rule.conditions, copy.storage.rules)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground text-xs">
                                                {copy.storage.rules.destination}
                                            </dt>
                                            <dd className="mt-1 wrap-anywhere">
                                                {configuration.buckets.find(bucket => bucket.id === rule.bucketId)
                                                    ?.label ?? rule.bucketId}
                                            </dd>
                                        </div>
                                    </dl>
                                    {mayManage ?
                                        <div className="flex flex-wrap justify-end gap-1 border-t pt-3">
                                            <Sheet>
                                                <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                                    {copy.common.edit}
                                                </SheetTrigger>
                                                <SheetContent className="sm:max-w-lg">
                                                    <SheetHeader>
                                                        <SheetTitle>
                                                            {copy.storage.rules.editTitle(rule.label)}
                                                        </SheetTitle>
                                                        <SheetDescription>
                                                            {copy.storage.rules.editDescription}
                                                        </SheetDescription>
                                                    </SheetHeader>
                                                    <RuleForm rule={rule} buckets={configuration.buckets} />
                                                </SheetContent>
                                            </Sheet>
                                            <DeleteStorageButton kind="rule" id={rule.id} label={rule.label} />
                                        </div>
                                    :   null}
                                </li>
                            ))}
                        </ul>
                        <div className="hidden overflow-hidden rounded-xl border lg:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {mayManage ?
                                            <TableHead className="w-20">{copy.storage.rules.order}</TableHead>
                                        :   null}
                                        <TableHead>{copy.storage.rules.rule}</TableHead>
                                        <TableHead>{copy.storage.rules.conditions}</TableHead>
                                        <TableHead>{copy.storage.rules.destination}</TableHead>
                                        {mayManage ?
                                            <TableHead className="text-right">{copy.storage.rules.actions}</TableHead>
                                        :   null}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rules.map((rule, index) => (
                                        <TableRow key={rule.id}>
                                            {mayManage ?
                                                <TableCell>
                                                    <MoveRuleButtons
                                                        rule={rule}
                                                        index={index}
                                                        total={rules.length}
                                                        labels={copy.storage.rules}
                                                    />
                                                </TableCell>
                                            :   null}
                                            <TableCell>
                                                <div className="font-medium">{rule.label}</div>
                                                <div className="text-muted-foreground text-xs">
                                                    {copy.storage.rules.priority(rule.priority)}
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
                                                    {conditionSummary(rule.conditions, copy.storage.rules)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {configuration.buckets.find(bucket => bucket.id === rule.bucketId)
                                                    ?.label ?? rule.bucketId}
                                            </TableCell>
                                            {mayManage ?
                                                <TableCell>
                                                    <div className="flex justify-end gap-1">
                                                        <Sheet>
                                                            <SheetTrigger render={<Button variant="ghost" size="sm" />}>
                                                                {copy.common.edit}
                                                            </SheetTrigger>
                                                            <SheetContent className="sm:max-w-lg">
                                                                <SheetHeader>
                                                                    <SheetTitle>
                                                                        {copy.storage.rules.editTitle(rule.label)}
                                                                    </SheetTitle>
                                                                    <SheetDescription>
                                                                        {copy.storage.rules.editDescription}
                                                                    </SheetDescription>
                                                                </SheetHeader>
                                                                <RuleForm rule={rule} buckets={configuration.buckets} />
                                                            </SheetContent>
                                                        </Sheet>
                                                        <DeleteStorageButton
                                                            kind="rule"
                                                            id={rule.id}
                                                            label={rule.label}
                                                        />
                                                    </div>
                                                </TableCell>
                                            :   null}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                }
            </section>
        </div>
    );
}

"use client";

import { useActionState, useState } from "react";
import type { SystemRoleGrantModel } from "@jamcaaxian/core/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveRoleGrants, type RoleGrantsFormState } from "./actions";

const RESOURCE_LABELS: Record<string, string> = {
    comment: "Comments",
    media: "Media",
    post: "Posts",
    role: "Roles",
    session: "Sessions",
    settings: "Settings",
    taxonomy: "Taxonomy",
    user: "Users"
};

function capabilityLabel(action: string) {
    return action
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function RoleGrantsForm({ model, mayManage }: { model: SystemRoleGrantModel; mayManage: boolean }) {
    const [selectedName, setSelectedName] = useState(model.roles[0]?.name ?? "");
    const [state, action, pending] = useActionState<RoleGrantsFormState, FormData>(saveRoleGrants, {});
    const selectedRole = model.roles.find(role => role.name === selectedName) ?? model.roles[0];
    const roleOptions = model.roles.map(role => ({ value: role.name, label: role.label }));

    if (!selectedRole) {
        return <p className="text-muted-foreground text-sm">No system Roles are installed.</p>;
    }

    return (
        <form action={action} className="max-w-5xl space-y-6">
            <input type="hidden" name="roleName" value={selectedRole.name} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <label htmlFor="role-selector" className="text-sm font-medium">
                        System Role
                    </label>
                    <Select
                        value={selectedRole.name}
                        onValueChange={value => setSelectedName(value ?? "")}
                        items={roleOptions}
                    >
                        <SelectTrigger id="role-selector" className="w-full sm:w-64">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {roleOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-muted-foreground max-w-xl text-sm leading-6">{selectedRole.description}</p>
                </div>

                <Badge variant={mayManage ? "secondary" : "outline"}>{mayManage ? "Manage access" : "Read only"}</Badge>
            </div>

            <div key={selectedRole.name} className="grid gap-4 md:grid-cols-2">
                {Object.entries(model.catalogue).map(([resource, actions]) => (
                    <Card key={resource} size="sm">
                        <fieldset className="flex min-w-0 flex-col gap-(--card-spacing) border-0 p-0">
                            <legend className="sr-only">{RESOURCE_LABELS[resource] ?? resource} capabilities</legend>
                            <CardHeader>
                                <CardTitle>{RESOURCE_LABELS[resource] ?? resource}</CardTitle>
                                <CardDescription>{resource}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                {actions.map(capability => {
                                    const recoveryGrant =
                                        selectedRole.name === "admin"
                                        && resource === "role"
                                        && (capability === "read" || capability === "manage");
                                    const checked =
                                        recoveryGrant || selectedRole.grants[resource]?.includes(capability) === true;
                                    const id = `${selectedRole.name}-${resource}-${capability}`;
                                    const descriptionId = recoveryGrant ? `${id}-description` : undefined;

                                    return (
                                        <div
                                            key={capability}
                                            className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                                        >
                                            <input
                                                id={id}
                                                name={`grant.${resource}`}
                                                value={capability}
                                                type="checkbox"
                                                defaultChecked={checked}
                                                disabled={!mayManage || recoveryGrant}
                                                aria-label={`${capabilityLabel(capability)} ${RESOURCE_LABELS[resource] ?? resource}`}
                                                aria-describedby={descriptionId}
                                                className="accent-primary mt-0.5 size-5 shrink-0"
                                            />
                                            <label htmlFor={id} className="min-w-0 flex-1 text-sm leading-5">
                                                <span className="font-medium">{capabilityLabel(capability)}</span>
                                                {recoveryGrant ?
                                                    <span
                                                        id={descriptionId}
                                                        className="text-muted-foreground mt-0.5 block text-xs leading-5"
                                                    >
                                                        Locked so an Administrator can always inspect and repair Role
                                                        capabilities.
                                                    </span>
                                                :   null}
                                            </label>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </fieldset>
                    </Card>
                ))}
            </div>

            <div aria-live="polite" className="space-y-2">
                {state.error ?
                    <FieldError errors={[{ message: state.error }]} />
                :   null}
                {state.saved ?
                    <p className="text-muted-foreground text-sm">Role capabilities saved.</p>
                :   null}
            </div>

            <Button type="submit" disabled={pending || !mayManage} className="w-full sm:w-auto">
                {pending ? "Saving…" : "Save Role capabilities"}
            </Button>
        </form>
    );
}

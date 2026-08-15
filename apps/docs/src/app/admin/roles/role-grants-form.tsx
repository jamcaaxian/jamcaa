"use client";

import { useActionState, useState } from "react";
import type { SystemRoleGrantModel } from "@jamcaaxian/core/auth";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveRoleGrants, type RoleGrantsFormState } from "./actions";

export function RoleGrantsForm({ model, mayManage }: { model: SystemRoleGrantModel; mayManage: boolean }) {
    const { copy } = useAdminI18n();
    const [selectedName, setSelectedName] = useState(model.roles[0]?.name ?? "");
    const [state, action, pending] = useActionState<RoleGrantsFormState, FormData>(saveRoleGrants, {});
    const selectedRole = model.roles.find(role => role.name === selectedName) ?? model.roles[0];
    const roleOptions = model.roles.map(role => ({
        value: role.name,
        label: copy.roles.roleLabels[role.name as keyof typeof copy.roles.roleLabels] ?? role.label
    }));

    if (!selectedRole) {
        return <p className="text-muted-foreground text-sm">{copy.roles.noRoles}</p>;
    }

    const roleDescription =
        copy.roles.roleDescriptions[selectedRole.name as keyof typeof copy.roles.roleDescriptions]
        ?? selectedRole.description;

    return (
        <form action={action} className="max-w-5xl space-y-6">
            <input type="hidden" name="roleName" value={selectedRole.name} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <label htmlFor="role-selector" className="text-sm font-medium">
                        {copy.roles.systemRole}
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
                    <p className="text-muted-foreground max-w-xl text-sm leading-6">{roleDescription}</p>
                </div>

                <Badge variant={mayManage ? "secondary" : "outline"}>
                    {mayManage ? copy.roles.manageAccess : copy.roles.readOnly}
                </Badge>
            </div>

            <div key={selectedRole.name} className="grid gap-4 md:grid-cols-2">
                {Object.entries(model.catalogue).map(([resource, actions]) => (
                    <Card key={resource} size="sm">
                        <fieldset className="flex min-w-0 flex-col gap-(--card-spacing) border-0 p-0">
                            <legend className="sr-only">
                                {copy.roles.capabilities(
                                    copy.roles.resources[resource as keyof typeof copy.roles.resources] ?? resource
                                )}
                            </legend>
                            <CardHeader>
                                <CardTitle>
                                    {copy.roles.resources[resource as keyof typeof copy.roles.resources] ?? resource}
                                </CardTitle>
                                <CardDescription>{resource}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                {actions.map(capability => {
                                    const recoveryGrant =
                                        selectedRole.name === "admin"
                                        && ((resource === "console" && capability === "access")
                                            || (resource === "role"
                                                && (capability === "read" || capability === "manage")));
                                    const checked =
                                        recoveryGrant || selectedRole.grants[resource]?.includes(capability) === true;
                                    const id = `${selectedRole.name}-${resource}-${capability}`;
                                    const descriptionId = recoveryGrant ? `${id}-description` : undefined;
                                    const capabilityName =
                                        copy.roles.actions[capability as keyof typeof copy.roles.actions] ?? capability;
                                    const resourceName =
                                        copy.roles.resources[resource as keyof typeof copy.roles.resources] ?? resource;

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
                                                aria-label={`${capabilityName} ${resourceName}`}
                                                aria-describedby={descriptionId}
                                                className="accent-primary mt-0.5 size-5 shrink-0"
                                            />
                                            <label htmlFor={id} className="min-w-0 flex-1 text-sm leading-5">
                                                <span className="font-medium">{capabilityName}</span>
                                                {recoveryGrant ?
                                                    <span
                                                        id={descriptionId}
                                                        className="text-muted-foreground mt-0.5 block text-xs leading-5"
                                                    >
                                                        {copy.roles.recovery}
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
                    <p className="text-muted-foreground text-sm">{copy.roles.saved}</p>
                :   null}
            </div>

            <Button type="submit" disabled={pending || !mayManage} className="w-full sm:w-auto">
                {pending ? copy.common.saving : copy.roles.save}
            </Button>
        </form>
    );
}

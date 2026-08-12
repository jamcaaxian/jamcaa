import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { role as roleTable } from "../db/schema/roles";
import { assertGrantsAreDeclared, type CapabilityCatalogue, type CapabilityGrants } from "./capabilities";
import { forgetCachedRoleGrants } from "./role-cache";
import { loadRoleGrants } from "./roles";

const ADMIN_RECOVERY_ACTIONS = ["read", "manage"];

export class RoleGrantError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RoleGrantError";
    }
}

export interface SystemRoleGrantView {
    name: string;
    label: string;
    description: string | null;
    grants: CapabilityGrants;
}

export interface SystemRoleGrantModel {
    catalogue: CapabilityCatalogue;
    roles: SystemRoleGrantView[];
}

function normalizeGrants(grants: CapabilityGrants): CapabilityGrants {
    return Object.fromEntries(
        Object.entries(grants)
            .map(([resource, actions]) => [resource, [...new Set(actions)].sort()] as const)
            .filter(([, actions]) => actions.length > 0)
            .sort(([left], [right]) => left.localeCompare(right))
    );
}

function withAdministratorRecoveryGrants(grants: CapabilityGrants): CapabilityGrants {
    return normalizeGrants({ ...grants, role: [...(grants.role ?? []), ...ADMIN_RECOVERY_ACTIONS] });
}

export async function inspectSystemRoleGrants(
    database: Database,
    catalogue: CapabilityCatalogue
): Promise<SystemRoleGrantModel> {
    const roles = await database
        .select({ name: roleTable.name, label: roleTable.label, description: roleTable.description })
        .from(roleTable)
        .where(eq(roleTable.isSystem, true))
        .all();
    const grants = await loadRoleGrants(database);

    return {
        catalogue: Object.fromEntries(Object.entries(catalogue).map(([resource, actions]) => [resource, [...actions]])),
        roles: roles
            .map(role => ({ ...role, grants: normalizeGrants(grants[role.name] ?? {}) }))
            .sort((left, right) => left.label.localeCompare(right.label))
    };
}

export async function replaceSystemRoleGrants(
    database: Database,
    catalogue: CapabilityCatalogue,
    roleName: string,
    grants: CapabilityGrants
): Promise<void> {
    try {
        assertGrantsAreDeclared(catalogue, grants);
    } catch (error) {
        throw new RoleGrantError(error instanceof Error ? error.message : "Those capabilities are not declared.");
    }

    const existing = await database
        .select({ isSystem: roleTable.isSystem })
        .from(roleTable)
        .where(eq(roleTable.name, roleName))
        .get();

    if (existing?.isSystem !== true) {
        throw new RoleGrantError(`Only an existing system Role can be re-granted: ${roleName}`);
    }

    const normalized = roleName === "admin" ? withAdministratorRecoveryGrants(grants) : normalizeGrants(grants);
    try {
        assertGrantsAreDeclared(catalogue, normalized);
    } catch (error) {
        throw new RoleGrantError(error instanceof Error ? error.message : "Those capabilities are not declared.");
    }

    const statements = [database.$client.prepare("DELETE FROM role_capability WHERE role_name = ?").bind(roleName)];
    const rows = Object.entries(normalized).flatMap(([resource, actions]) =>
        actions.map(action => [roleName, resource, action] as const)
    );

    if (rows.length > 0) {
        const values = rows.map(() => "(?, ?, ?)").join(", ");
        statements.push(
            database.$client
                .prepare(`INSERT INTO role_capability (role_name, resource, action) VALUES ${values}`)
                .bind(...rows.flat())
        );
    }

    await database.$client.batch(statements);
    forgetCachedRoleGrants();
}

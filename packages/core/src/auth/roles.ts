import { createAccessControl } from "better-auth/plugins/access";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { role as roleTable, roleCapability } from "../db/schema/roles";
import {
    assertGrantsAreDeclared,
    type CapabilityCatalogue,
    type CapabilityGrants
} from "./capabilities";

export interface SystemRole {
    name: string;
    label: string;
    description: string;
    /** Omitted for the administrator, who is granted the whole catalogue. */
    grants?: CapabilityGrants;
}

/**
 * The roles every site starts with. Sites may add, remove, or re-grant roles
 * afterwards; these exist so a fresh install is usable and so the vocabulary
 * matches what people migrating from established platforms expect.
 */
export const systemRoles: SystemRole[] = [
    {
        name: "admin",
        label: "Administrator",
        description: "Full control, including site settings and user management."
    },
    {
        name: "editor",
        label: "Editor",
        description: "Publishes and manages content from any author.",
        grants: {
            post: [
                "create",
                "read",
                "update-own",
                "delete-own",
                "publish-own",
                "update-any",
                "delete-any",
                "publish-any"
            ],
            media: ["upload", "read", "delete-own", "delete-any"],
            comment: ["create", "moderate", "delete-any"],
            settings: ["read"]
        }
    },
    {
        name: "author",
        label: "Author",
        description: "Publishes and manages their own content.",
        grants: {
            post: ["create", "read", "update-own", "delete-own", "publish-own"],
            media: ["upload", "read", "delete-own"],
            comment: ["create"]
        }
    },
    {
        name: "contributor",
        label: "Contributor",
        description: "Writes their own content but cannot publish it.",
        grants: {
            post: ["create", "read", "update-own", "delete-own"],
            media: ["upload", "read"],
            comment: ["create"]
        }
    },
    {
        name: "subscriber",
        label: "Subscriber",
        description: "Reads content and takes part in discussion.",
        grants: {
            post: ["read"],
            comment: ["create"]
        }
    }
];

/** Every action in the catalogue. Derived so new capabilities reach admins automatically. */
export function grantEverything(catalogue: CapabilityCatalogue): CapabilityGrants {
    return Object.fromEntries(
        Object.entries(catalogue).map(([resource, actions]) => [resource, [...actions]])
    );
}

function resolveSystemGrants(catalogue: CapabilityCatalogue, systemRole: SystemRole): CapabilityGrants {
    return systemRole.grants ?? grantEverything(catalogue);
}

/**
 * Writes the system roles into an empty database. Existing roles are left alone so
 * that re-running this never discards a site's own grants.
 */
export async function seedSystemRoles(database: Database, catalogue: CapabilityCatalogue): Promise<void> {
    for (const systemRole of systemRoles) {
        const existing = await database
            .select({ name: roleTable.name })
            .from(roleTable)
            .where(eq(roleTable.name, systemRole.name))
            .get();

        if (existing) {
            continue;
        }

        const grants = resolveSystemGrants(catalogue, systemRole);
        assertGrantsAreDeclared(catalogue, grants);

        await database.insert(roleTable).values({
            name: systemRole.name,
            label: systemRole.label,
            description: systemRole.description,
            isSystem: true
        });

        const rows = Object.entries(grants).flatMap(([resource, actions]) =>
            actions.map((action) => ({ roleName: systemRole.name, resource, action }))
        );

        if (rows.length > 0) {
            await database.insert(roleCapability).values(rows);
        }
    }
}

/** Reads every role and its grants out of the database. */
export async function loadRoleGrants(database: Database): Promise<Record<string, CapabilityGrants>> {
    const rows = await database
        .select({
            roleName: roleCapability.roleName,
            resource: roleCapability.resource,
            action: roleCapability.action
        })
        .from(roleCapability)
        .all();

    const grants: Record<string, CapabilityGrants> = {};

    for (const row of rows) {
        const forRole = (grants[row.roleName] ??= {});
        (forRole[row.resource] ??= []).push(row.action);
    }

    return grants;
}

/**
 * Turns database rows into the access controller and roles the admin plugin expects.
 * The controller builds roles from plain objects at call time, so grants do not have
 * to be known when the application starts.
 */
export function buildAccessControl(
    catalogue: CapabilityCatalogue,
    grants: Record<string, CapabilityGrants>
) {
    const accessControl = createAccessControl(catalogue as Record<string, readonly string[]>);

    const roles = Object.fromEntries(
        Object.entries(grants).map(([name, roleGrants]) => [name, accessControl.newRole(roleGrants)])
    );

    return { accessControl, roles };
}
